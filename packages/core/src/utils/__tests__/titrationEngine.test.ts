// Testes do MOTOR de avanço N2 (029 F3 / T012 / PO-1 + PO-3).
//
// `resolveTitrationAdvanceFromSteps` é PURO: decide o que a escada faz HOJE, sem relógio nem I/O.
// O cron só aplica o plano (as travas de concorrência são testadas em titrationEngine.concurrency).
//
// Duas propriedades que estes testes travam:
//   1. O motor NUNCA troca de medicamento sozinho (Decisões §10): a etapa vigente segue vigente
//      e a próxima só vira `pending_confirmation`.
//   2. Vencimento por DIA LOCAL do dono (R-253/R-254), não por horário de início.
//
// Datas SEMPRE locais (AP-270): nada de toISOString() para derivar dia.

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  resolveTitrationAdvanceFromSteps,
  type TitrationStepEngineLike,
} from '../titrationUtils'

const TZ = 'America/Sao_Paulo'
const MED_A = 'med-aaaa-0000-0000-000000000001'
const MED_B = 'med-bbbb-0000-0000-000000000002'

/** Etapa da escada. `started_at` em meia-noite LOCAL — é o que o motor grava ao avançar. */
function step(overrides: Partial<TitrationStepEngineLike>): TitrationStepEngineLike {
  return {
    id: `step-${overrides.position ?? 0}`,
    position: 0,
    medicine_id: MED_A,
    dose: 1,
    intake_unit: 'cp',
    duration_days: 28,
    status: 'upcoming',
    started_at: null,
    protocol_id: 'proto-1',
    ...overrides,
  }
}

/** Escada intra-medicamento (caso metoprolol/N1): 3 etapas do MESMO medicamento. */
function intraMedLadder(startedAt: string | null) {
  return [
    step({ position: 0, dose: 1, status: 'current', started_at: startedAt }),
    step({ position: 1, dose: 2 }),
    step({ position: 2, dose: 3 }),
  ]
}

/** Escada cross-medicamento (caso GLP-1): a etapa 1 troca de medicamento. */
function crossMedLadder(startedAt: string | null) {
  return [
    step({ position: 0, dose: 0.25, intake_unit: 'mg', medicine_id: MED_A, status: 'current', started_at: startedAt }),
    step({ position: 1, dose: 0.5, intake_unit: 'mg', medicine_id: MED_B, protocol_id: null }),
  ]
}

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('resolveTitrationAdvanceFromSteps — nada vence', () => {
  it('dentro da etapa vigente → null', () => {
    // Etapa começou em 01/03 e dura 28 dias → vence em 29/03. Hoje é 10/03.
    expect(resolveTitrationAdvanceFromSteps(intraMedLadder('2026-03-01T00:00:00-03:00'), '2026-03-10', TZ)).toBeNull()
  })

  it('escada sem etapa vigente (tratamento pausado) → null', () => {
    const steps = intraMedLadder('2026-03-01T00:00:00-03:00').map((s) => ({ ...s, status: 'upcoming' }))
    expect(resolveTitrationAdvanceFromSteps(steps, '2026-12-31', TZ)).toBeNull()
  })

  it('🔴 EDGE REAL DE PROD: vigente sem started_at (titulação dormente) → null, nunca avança', () => {
    // O protocolo "GLP" em prod tem stage_started_at NULL (titulando nunca iniciado); a migração
    // F2 espelhou fielmente: step0 'current' com started_at NULL. Sem âncora não há vencimento.
    expect(resolveTitrationAdvanceFromSteps(intraMedLadder(null), '2099-01-01', TZ)).toBeNull()
  })

  it('vigente contínua (duration_days null = alvo atingido) → null, não vence nunca', () => {
    const steps = [step({ position: 0, status: 'current', started_at: '2020-01-01T00:00:00-03:00', duration_days: null })]
    expect(resolveTitrationAdvanceFromSteps(steps, '2099-01-01', TZ)).toBeNull()
  })

  it('degenerados → null: sem etapas, array vazio, hoje vazio', () => {
    expect(resolveTitrationAdvanceFromSteps(null, '2026-03-10', TZ)).toBeNull()
    expect(resolveTitrationAdvanceFromSteps([], '2026-03-10', TZ)).toBeNull()
    expect(resolveTitrationAdvanceFromSteps(intraMedLadder('2026-03-01T00:00:00-03:00'), '', TZ)).toBeNull()
  })
})

describe('resolveTitrationAdvanceFromSteps — dose_change (automático, paridade N1)', () => {
  it('etapa vencida, mesmo medicamento → avança sozinho e encerra a anterior', () => {
    const plan = resolveTitrationAdvanceFromSteps(intraMedLadder('2026-03-01T00:00:00-03:00'), '2026-03-29', TZ)

    expect(plan?.transition).toBe('dose_change')
    expect(plan?.pending).toBeNull() // nada a confirmar: o usuário não é incomodado (US3)
    expect(plan?.completed.map((c) => c.id)).toEqual(['step-0'])
    expect(plan?.activated?.id).toBe('step-1')
    expect(plan?.activated?.dose).toBe(2)
    expect(plan?.totalSteps).toBe(3)
  })

  it('started_at da etapa nova = fim ACUMULADO, não hoje (atraso do cron não desloca a escada)', () => {
    // Cron parado: só rodou em 05/04, mas a etapa 1 venceu em 29/03.
    const plan = resolveTitrationAdvanceFromSteps(intraMedLadder('2026-03-01T00:00:00-03:00'), '2026-04-05', TZ)

    // 01/03 + 28d = 29/03 → etapa 2 começa em 29/03; +28d = 26/04 (ainda não venceu em 05/04).
    expect(plan?.activated?.id).toBe('step-1')
    expect(plan?.activated?.startedAtIso).toBe('2026-03-29T03:00:00.000Z') // meia-noite de 29/03 em SP
  })

  it('várias etapas vencidas (cron parado por semanas) → um único plano, não N notificações', () => {
    // 01/03 +28d = 29/03 (etapa 2) +28d = 26/04 (etapa 3). Hoje 01/05 → as duas venceram.
    const plan = resolveTitrationAdvanceFromSteps(intraMedLadder('2026-03-01T00:00:00-03:00'), '2026-05-01', TZ)

    expect(plan?.transition).toBe('dose_change')
    expect(plan?.completed.map((c) => c.id)).toEqual(['step-0', 'step-1'])
    expect(plan?.activated?.id).toBe('step-2') // aterrissa direto na etapa vigente de hoje
    expect(plan?.activated?.dose).toBe(3)
  })

  it('última etapa finita esgotada → target_reached (titulação para de reger a dose)', () => {
    // 3 etapas × 28d = 84d. Hoje muito além.
    const plan = resolveTitrationAdvanceFromSteps(intraMedLadder('2026-03-01T00:00:00-03:00'), '2026-08-01', TZ)

    expect(plan?.transition).toBe('target_reached')
    expect(plan?.activated).toBeNull()
    expect(plan?.pending).toBeNull()
    expect(plan?.completed.map((c) => c.id)).toEqual(['step-0', 'step-1', 'step-2'])
  })
})

describe('resolveTitrationAdvanceFromSteps — medicine_switch (pendente, NUNCA automático)', () => {
  it('etapa vencida com medicamento diferente → pendura a próxima e NÃO encerra a vigente', () => {
    const plan = resolveTitrationAdvanceFromSteps(crossMedLadder('2026-03-01T00:00:00-03:00'), '2026-03-29', TZ)

    expect(plan?.transition).toBe('medicine_switch')
    expect(plan?.pending?.id).toBe('step-1')
    expect(plan?.pending?.medicineId).toBe(MED_B)
    expect(plan?.activated).toBeNull()
    // A vigente NÃO entra em `completed`: ela segue regendo os lembretes na dose antiga
    // até o usuário confirmar (Decisões §3.2 "os lembretes seguem na Semaglutida 0,25 mg").
    expect(plan?.completed).toEqual([])
  })

  it('etapa vencida há muito tempo → segue apenas pendente (nunca avança sozinho — §10)', () => {
    const plan = resolveTitrationAdvanceFromSteps(crossMedLadder('2026-03-01T00:00:00-03:00'), '2027-01-01', TZ)

    expect(plan?.transition).toBe('medicine_switch')
    expect(plan?.pending?.id).toBe('step-1')
    expect(plan?.completed).toEqual([])
  })

  it('cadeia mista: dose_change vencido + switch adiante → avança a dose e para no switch', () => {
    const steps = [
      step({ position: 0, dose: 1, medicine_id: MED_A, status: 'current', started_at: '2026-03-01T00:00:00-03:00' }),
      step({ position: 1, dose: 2, medicine_id: MED_A }),
      step({ position: 2, dose: 0.5, medicine_id: MED_B, protocol_id: null }),
    ]
    // 01/03 +28d = 29/03 (dose_change p/ step-1) +28d = 26/04 (switch p/ step-2). Hoje 01/05.
    const plan = resolveTitrationAdvanceFromSteps(steps, '2026-05-01', TZ)

    expect(plan?.transition).toBe('medicine_switch')
    expect(plan?.completed.map((c) => c.id)).toEqual(['step-0']) // só o dose_change encerrou
    expect(plan?.activated?.id).toBe('step-1') // a etapa do MESMO medicamento vigora...
    expect(plan?.pending?.id).toBe('step-2') // ...e a troca fica aguardando o usuário
  })
})

describe('resolveTitrationAdvanceFromSteps — vencimento por dia local (R-253/R-254)', () => {
  it('vence na virada do dia local do dono, não no horário de início', () => {
    // Etapa iniciada às 22:00 de 01/03 em SP, 2 dias de duração → cobre 01/03 e 02/03.
    const steps = [
      step({ position: 0, dose: 1, duration_days: 2, status: 'current', started_at: '2026-03-01T22:00:00-03:00' }),
      step({ position: 1, dose: 2 }),
    ]
    // Dia 02/03: ainda dentro da etapa.
    expect(resolveTitrationAdvanceFromSteps(steps, '2026-03-02', TZ)).toBeNull()
    // Dia 03/03: vence LOGO NA VIRADA (00:00). O legado, somando 2×24h sobre as 22:00, só
    // avançaria às 22:00 do dia 03 — 22h de atraso, com a dose antiga valendo o dia inteiro.
    expect(resolveTitrationAdvanceFromSteps(steps, '2026-03-03', TZ)?.activated?.id).toBe('step-1')
  })

  it('o dia local é o do DONO: mesmo instante, fuso diferente → vencimento diferente', () => {
    // 01/03 21:00 em SP = 02/03 00:00 em Londres (UTC nesta data). Duração 1 dia.
    const steps = [
      step({ position: 0, dose: 1, duration_days: 1, status: 'current', started_at: '2026-03-02T00:00:00Z' }),
      step({ position: 1, dose: 2 }),
    ]
    // Em Londres a etapa começou dia 02 → vence dia 03.
    expect(resolveTitrationAdvanceFromSteps(steps, '2026-03-03', 'Europe/London')?.activated?.id).toBe('step-1')
    // Em SP começou dia 01 (21:00) → já venceu no dia 02.
    expect(resolveTitrationAdvanceFromSteps(steps, '2026-03-02', TZ)?.activated?.id).toBe('step-1')
    expect(resolveTitrationAdvanceFromSteps(steps, '2026-03-02', 'Europe/London')).toBeNull()
  })

  it('etapas fora de ordem no array → ordenadas por position (não confia no banco)', () => {
    const steps = [...intraMedLadder('2026-03-01T00:00:00-03:00')].reverse()
    const plan = resolveTitrationAdvanceFromSteps(steps, '2026-03-29', TZ)
    expect(plan?.activated?.id).toBe('step-1')
  })
})
