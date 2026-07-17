// Progresso da etapa vigente para EXIBIÇÃO (badge/timeline/PDF de consulta) — 029 F3.1 / T017e.
//
// Reancorada no pivô da 029: a versão anterior exercitava `calculateTitrationData(protocol)`
// lendo o jsonb N1 (`titration_schedule`/`current_stage_index`/`stage_started_at`) — a titulação
// que nunca funcionou em produção (AP-301) e cujas colunas caem no F6. A função agora lê
// `titration_steps`, a fonte única.
//
// `now` é INJETADO em todo caso (a função é clock-free por parâmetro): sumiu o mock de
// `global.Date` que a versão anterior precisava. Datas locais (AP-270).

import { describe, it, expect } from 'vitest'
import { calculateTitrationData, type TitrationStepLike } from '../titrationUtils'

const STAGE_START = '2026-03-01T00:00:00'
const start = new Date(STAGE_START)
const DAY = 24 * 60 * 60 * 1000
const atDay = (n: number) => new Date(start.getTime() + n * DAY)

/** Escada 3 etapas, 28 dias cada; vigente = posição 1 (a do meio). */
const emEvolucao: TitrationStepLike[] = [
  { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
  { position: 1, dose: 0.5, duration_days: 28, status: 'current', started_at: STAGE_START },
  { position: 2, dose: 1.0, duration_days: 28, status: 'upcoming', started_at: null },
]

describe('calculateTitrationData — progresso da etapa vigente', () => {
  it('etapa 2 de 3, dia 5 de 28', () => {
    expect(calculateTitrationData(emEvolucao, atDay(5))).toEqual({
      currentStep: 2, // 1-based p/ exibição ("Etapa 2/3")
      totalSteps: 3,
      day: 5, // Math.ceil dos dias corridos, com piso 1
      realDay: 5,
      totalDays: 28,
      progressPercent: (5 / 28) * 100,
      isTransitionDue: false,
      daysRemaining: 23,
    })
  })

  it('piso do dia 1: no próprio instante de início já é "dia 1", nunca 0', () => {
    const r = calculateTitrationData(emEvolucao, atDay(0))
    expect(r?.day).toBe(1)
    expect(r?.realDay).toBe(1)
  })

  it('no último dia da etapa a transição ainda NÃO venceu', () => {
    const r = calculateTitrationData(emEvolucao, atDay(28))
    expect(r?.realDay).toBe(28)
    expect(r?.isTransitionDue).toBe(false) // vence em > 28, não em == 28
    expect(r?.daysRemaining).toBe(0)
  })

  it('transição vencida: passou dos 28 dias → isTransitionDue, com day/percent CAPADOS', () => {
    const r = calculateTitrationData(emEvolucao, atDay(29))
    expect(r?.isTransitionDue).toBe(true)
    expect(r?.realDay).toBe(29) // dia real segue contando (é o atraso)
    expect(r?.day).toBe(28) // `day` é o cap VISUAL: a barra não passa do fim
    expect(r?.progressPercent).toBe(100) // idem — nunca > 100%
    expect(r?.daysRemaining).toBe(-1) // negativo = quantos dias de atraso
  })

  it('ordena por position (entrada desordenada não desloca o índice exibido)', () => {
    const desordenada = [emEvolucao[2], emEvolucao[0], emEvolucao[1]]
    expect(calculateTitrationData(desordenada, atDay(5))?.currentStep).toBe(2)
  })

  it('escada de 1 etapa: etapa 1 de 1', () => {
    const unica: TitrationStepLike[] = [
      { position: 0, dose: 1, duration_days: 7, status: 'current', started_at: STAGE_START },
    ]
    const r = calculateTitrationData(unica, atDay(1))
    expect(r?.currentStep).toBe(1)
    expect(r?.totalSteps).toBe(1)
  })
})

describe('calculateTitrationData — sem progresso a exibir (null)', () => {
  it('lista vazia/null/undefined → null', () => {
    expect(calculateTitrationData([], atDay(5))).toBeNull()
    expect(calculateTitrationData(null, atDay(5))).toBeNull()
    expect(calculateTitrationData(undefined, atDay(5))).toBeNull()
  })

  it('nenhuma etapa current (escada pausada/concluída) → null', () => {
    const semVigente: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: STAGE_START },
      { position: 1, dose: 0.5, duration_days: 28, status: 'upcoming', started_at: null },
    ]
    expect(calculateTitrationData(semVigente, atDay(5))).toBeNull()
  })

  it('vigente CONTÍNUA (duration_days null) = manutenção/alvo → null (não há progresso)', () => {
    const manutencao: TitrationStepLike[] = [
      { position: 0, dose: 1.0, duration_days: null, status: 'current', started_at: STAGE_START },
    ]
    expect(calculateTitrationData(manutencao, atDay(5))).toBeNull()
  })

  it('vigente SEM started_at (o zumbi do AP-301) → null', () => {
    // Sem relógio não há progresso a calcular. O CHECK do T017a impede o estado de existir no
    // banco; a exibição segue defensiva (defesa em profundidade).
    const zumbi: TitrationStepLike[] = [
      { position: 0, dose: 0.5, duration_days: 28, status: 'current', started_at: null },
    ]
    expect(calculateTitrationData(zumbi, atDay(5))).toBeNull()
  })

  it('duração 0/negativa → tratada como contínua → null (nunca divide por zero)', () => {
    const mk = (d: any): TitrationStepLike[] => [
      { position: 0, dose: 0.5, duration_days: d, status: 'current', started_at: STAGE_START },
    ]
    expect(calculateTitrationData(mk(0), atDay(5))).toBeNull()
    expect(calculateTitrationData(mk(-7), atDay(5))).toBeNull()
  })
})
