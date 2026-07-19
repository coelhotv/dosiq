// Comportamento da LEITURA da escada (029 F3.1 / T017e) — `resolveTitrationStageAt`.
//
// Esta suíte nasceu como prova de PARIDADE N1↔N2 (F2/T009/PO-5): testes verdes comparando a
// leitura nova com a legada. O pivô da 029 (2026-07-16) revelou que ela media paridade com um
// CADÁVER — a titulação N1 nunca funcionou em produção (AP-301), então "igual ao legado" não
// provava nada sobre estar certo. Os CASOS eram bons; a métrica é que era vazia.
//
// Aqui cada caso afirma o comportamento ABSOLUTO esperado: qual dose a escada rege em qual data.
// Datas SEMPRE locais (AP-270 — nunca toISOString p/ derivar dia).

import { describe, it, expect } from 'vitest'
import { resolveTitrationStageAt, type TitrationStepLike } from '../titrationUtils'

// Início da etapa vigente — meia-noite LOCAL.
const STAGE_START = '2026-03-01T00:00:00'
const startMs = new Date(STAGE_START).getTime()
const DAY = 24 * 60 * 60 * 1000

const DATE_IN_CURRENT = startMs + 5 * DAY
const DATE_NEXT_STAGE = startMs + 30 * DAY
const DATE_BEFORE = startMs - 1 * DAY

describe('resolveTitrationStageAt — a escada rege a dose', () => {
  // Escada same-med canônica: 0,25 → 0,5 → 1,0 mg, 28 dias cada. Vigente = posição 1.
  const emEvolucao: TitrationStepLike[] = [
    { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
    { position: 1, dose: 0.5, duration_days: 28, status: 'current', started_at: STAGE_START },
    { position: 2, dose: 1.0, duration_days: 28, status: 'upcoming', started_at: null },
  ]

  it('dentro da etapa vigente → dose da vigente', () => {
    expect(resolveTitrationStageAt(emEvolucao, DATE_IN_CURRENT)).toEqual({
      stageIndex: 1,
      dosage: 0.5,
      medicine_id: null,
    })
  })

  it('data ALÉM da duração da vigente → dose da PRÓXIMA (walk-forward)', () => {
    // O gerador congela `expected_dose` na data da ocorrência: uma instância futura já nasce
    // com a dose da etapa futura, sem esperar o avanço formal no banco (FR-006/FP-1/ADR-050).
    expect(resolveTitrationStageAt(emEvolucao, DATE_NEXT_STAGE)).toEqual({
      stageIndex: 2,
      dosage: 1.0,
      medicine_id: null,
    })
  })

  it('data ANTERIOR ao início da vigente → null (histórico congelado, não re-derivar)', () => {
    expect(resolveTitrationStageAt(emEvolucao, DATE_BEFORE)).toBeNull()
  })

  it('para na ÚLTIMA etapa (não caminha além do fim da escada)', () => {
    expect(resolveTitrationStageAt(emEvolucao, startMs + 999 * DAY)).toEqual({
      stageIndex: 2,
      dosage: 1.0,
      medicine_id: null,
    })
  })

  it('ordena por position antes de caminhar (entrada desordenada)', () => {
    const desordenada = [emEvolucao[2], emEvolucao[1], emEvolucao[0]]
    expect(resolveTitrationStageAt(desordenada, DATE_IN_CURRENT)?.dosage).toBe(0.5)
    expect(resolveTitrationStageAt(desordenada, DATE_NEXT_STAGE)?.dosage).toBe(1.0)
  })

  it('etapa CONTÍNUA no meio da escada trava a SAÍDA dela, não a entrada', () => {
    // Caminha até a etapa contínua e PARA nela — ela não tem fim previsto, então nenhuma data
    // futura a ultrapassa. É como a manutenção ancora a escada.
    const comManutencao: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'current', started_at: STAGE_START },
      { position: 1, dose: 0.5, duration_days: null, status: 'upcoming', started_at: null },
      { position: 2, dose: 1.0, duration_days: 28, status: 'upcoming', started_at: null },
    ]
    expect(resolveTitrationStageAt(comManutencao, DATE_NEXT_STAGE)).toEqual({
      stageIndex: 1,
      dosage: 0.5,
      medicine_id: null,
    })
    expect(resolveTitrationStageAt(comManutencao, startMs + 999 * DAY)?.dosage).toBe(0.5)
  })
})

describe('resolveTitrationStageAt — medicine_id da etapa (052)', () => {
  it('devolve o medicine_id da etapa RESOLVIDA, não o da vigente hoje', () => {
    const crossMed: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'current', started_at: STAGE_START, medicine_id: 'MED-A' },
      { position: 1, dose: 0.5, duration_days: 28, status: 'upcoming', started_at: null, medicine_id: 'MED-B' },
    ]
    expect(resolveTitrationStageAt(crossMed, DATE_IN_CURRENT)?.medicine_id).toBe('MED-A')
    expect(resolveTitrationStageAt(crossMed, DATE_NEXT_STAGE)?.medicine_id).toBe('MED-B')
  })

  it('etapa sem medicine_id (embed legado) → null, nunca undefined (o chamador faz o fallback)', () => {
    const semMedicine: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'current', started_at: STAGE_START },
    ]
    expect(resolveTitrationStageAt(semMedicine, DATE_IN_CURRENT)?.medicine_id).toBeNull()
  })
})

describe('resolveTitrationStageAt — a escada NÃO rege a dose', () => {
  // Nestes estados a dose vem de `protocols.dosage_per_intake`, não da escada.
  it('escada pausada/concluída (nenhuma etapa current) → null', () => {
    const semVigente: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: STAGE_START },
      { position: 1, dose: 0.5, duration_days: 28, status: 'upcoming', started_at: null },
    ]
    expect(resolveTitrationStageAt(semVigente, DATE_IN_CURRENT)).toBeNull()
  })

  it('vigente CONTÍNUA (duration_days null) = alvo atingido/manutenção → null', () => {
    const manutencao: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
      { position: 1, dose: 1.0, duration_days: null, status: 'current', started_at: STAGE_START },
    ]
    expect(resolveTitrationStageAt(manutencao, DATE_IN_CURRENT)).toBeNull()
  })
})

describe('resolveTitrationStageAt — modos degenerados', () => {
  it('lista vazia/null/undefined → null', () => {
    expect(resolveTitrationStageAt([], DATE_IN_CURRENT)).toBeNull()
    expect(resolveTitrationStageAt(null, DATE_IN_CURRENT)).toBeNull()
    expect(resolveTitrationStageAt(undefined, DATE_IN_CURRENT)).toBeNull()
  })

  it('vigente SEM started_at (o zumbi do AP-301) → null', () => {
    // Este é o estado que matou a titulação N1: status diz "ligada", relógio nunca começou.
    // O motor sempre o ignorou — corretamente, não há t₀ de onde contar. O que faltava era o
    // banco RECUSAR o estado: CHECK `titration_steps_current_exige_started_check` (T017a).
    // A leitura segue defensiva mesmo com o CHECK: defesa em profundidade.
    const zumbi: TitrationStepLike[] = [
      { position: 0, dose: 0.5, duration_days: 28, status: 'current', started_at: null },
    ]
    expect(resolveTitrationStageAt(zumbi, DATE_IN_CURRENT)).toBeNull()
  })

  it('dose 0/negativa/ausente → null (nunca deriva dose inválida)', () => {
    const mk = (dose: any): TitrationStepLike[] => [
      { position: 0, dose, duration_days: 28, status: 'current', started_at: STAGE_START },
    ]
    expect(resolveTitrationStageAt(mk(0), DATE_IN_CURRENT)).toBeNull()
    expect(resolveTitrationStageAt(mk(-1), DATE_IN_CURRENT)).toBeNull()
    expect(resolveTitrationStageAt(mk(undefined), DATE_IN_CURRENT)).toBeNull()
  })

  it('started_at inválido → null (não NaN silencioso)', () => {
    const steps: TitrationStepLike[] = [
      { position: 0, dose: 0.5, duration_days: 28, status: 'current', started_at: 'não-é-data' },
    ]
    expect(resolveTitrationStageAt(steps, DATE_IN_CURRENT)).toBeNull()
  })

  it('duração 0/negativa na vigente → tratada como contínua → null', () => {
    const steps: TitrationStepLike[] = [
      { position: 0, dose: 0.5, duration_days: 0, status: 'current', started_at: STAGE_START },
    ]
    expect(resolveTitrationStageAt(steps, DATE_IN_CURRENT)).toBeNull()
  })
})
