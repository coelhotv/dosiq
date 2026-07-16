// Testes do ADAPTER dual-read N1↔N2 (029 F2 / T007 + T009 / PO-5).
//
// PARIDADE: para escadas intra-medicamento migradas, `resolveTitrationStageAtFromSteps` (N2)
// devolve a MESMA dose vigente por data que `resolveTitrationStageAt` (N1 legado). Os fixtures
// espelham o que a migração `20260716_titrations_data_migration.sql` produz para cada estado
// (titulando/pausado/alvo_atingido). Datas SEMPRE locais (AP-270).

import { describe, it, expect } from 'vitest'
import {
  resolveTitrationStageAt,
  resolveTitrationStageAtFromSteps,
  getTitrationSource,
  type TitrationProtocol,
  type TitrationStepLike,
} from '../titrationUtils'

// Início da etapa vigente — meia-noite LOCAL (nunca toISOString p/ derivar dia, AP-270).
const STAGE_START = '2026-03-01T00:00:00'
const startMs = new Date(STAGE_START).getTime()
const DAY = 24 * 60 * 60 * 1000

// Escada 3 estágios, mesma medicação (intra-med): 0,25 → 0,5 → 1,0 mg, 28 dias cada.
const SCHEDULE = [
  { dosage: 0.25, duration_days: 28 },
  { dosage: 0.5, duration_days: 28 },
  { dosage: 1.0, duration_days: 28 },
]

// 3 datas simuladas: dentro da etapa vigente, cruzando p/ a próxima, e antes do início.
const DATE_IN_CURRENT = startMs + 5 * DAY
const DATE_NEXT_STAGE = startMs + 30 * DAY
const DATE_BEFORE = startMs - 1 * DAY
const DATES = [DATE_IN_CURRENT, DATE_NEXT_STAGE, DATE_BEFORE]

describe('getTitrationSource', () => {
  it("default 'n1' quando env ausente/diferente", () => {
    const prev = process.env.TITRATION_SOURCE
    delete process.env.TITRATION_SOURCE
    expect(getTitrationSource()).toBe('n1')
    process.env.TITRATION_SOURCE = 'qualquer'
    expect(getTitrationSource()).toBe('n1')
    if (prev === undefined) delete process.env.TITRATION_SOURCE
    else process.env.TITRATION_SOURCE = prev
  })

  it("'n2' quando env = n2", () => {
    const prev = process.env.TITRATION_SOURCE
    process.env.TITRATION_SOURCE = 'n2'
    expect(getTitrationSource()).toBe('n2')
    if (prev === undefined) delete process.env.TITRATION_SOURCE
    else process.env.TITRATION_SOURCE = prev
  })
})

describe('paridade N1 legado vs N2 FromSteps (PO-5)', () => {
  it('titulando: mesma dose vigente por data (current no índice 1)', () => {
    const protocol: TitrationProtocol = {
      titration_schedule: SCHEDULE,
      current_stage_index: 1,
      stage_started_at: STAGE_START,
      titration_status: 'titulando',
    }
    // Migração: pos0 completed · pos1 current(started_at) · pos2 upcoming.
    const steps: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
      { position: 1, dose: 0.5, duration_days: 28, status: 'current', started_at: STAGE_START },
      { position: 2, dose: 1.0, duration_days: 28, status: 'upcoming', started_at: null },
    ]

    for (const at of DATES) {
      const legacy = resolveTitrationStageAt(protocol, at)
      const n2 = resolveTitrationStageAtFromSteps(steps, at)
      expect(n2).toEqual(legacy)
    }
    // Sanidade: dentro da etapa = 0,5; cruzando = 1,0; antes = null.
    expect(resolveTitrationStageAtFromSteps(steps, DATE_IN_CURRENT)?.dosage).toBe(0.5)
    expect(resolveTitrationStageAtFromSteps(steps, DATE_NEXT_STAGE)?.dosage).toBe(1.0)
    expect(resolveTitrationStageAtFromSteps(steps, DATE_BEFORE)).toBeNull()
  })

  it('pausado: legado null em toda data → FromSteps null (sem etapa current)', () => {
    const protocol: TitrationProtocol = {
      titration_schedule: SCHEDULE,
      current_stage_index: 1,
      stage_started_at: STAGE_START,
      titration_status: 'pausado',
    }
    // Migração pausado: nenhuma etapa 'current'.
    const steps: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
      { position: 1, dose: 0.5, duration_days: 28, status: 'upcoming', started_at: null },
      { position: 2, dose: 1.0, duration_days: 28, status: 'upcoming', started_at: null },
    ]

    for (const at of DATES) {
      expect(resolveTitrationStageAt(protocol, at)).toBeNull()
      expect(resolveTitrationStageAtFromSteps(steps, at)).toBeNull()
    }
  })

  it('alvo_atingido: legado null → FromSteps null (última etapa contínua vigente)', () => {
    const protocol: TitrationProtocol = {
      titration_schedule: SCHEDULE,
      current_stage_index: 2,
      stage_started_at: STAGE_START,
      titration_status: 'alvo_atingido',
    }
    // Migração alvo: última etapa current + contínua (duration_days null).
    const steps: TitrationStepLike[] = [
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
      { position: 1, dose: 0.5, duration_days: 28, status: 'completed', started_at: null },
      { position: 2, dose: 1.0, duration_days: null, status: 'current', started_at: STAGE_START },
    ]

    for (const at of DATES) {
      expect(resolveTitrationStageAt(protocol, at)).toBeNull()
      expect(resolveTitrationStageAtFromSteps(steps, at)).toBeNull()
    }
  })
})

describe('resolveTitrationStageAtFromSteps — modos degenerados', () => {
  it('lista vazia/null → null', () => {
    expect(resolveTitrationStageAtFromSteps([], DATE_IN_CURRENT)).toBeNull()
    expect(resolveTitrationStageAtFromSteps(null, DATE_IN_CURRENT)).toBeNull()
  })

  it('etapa current sem started_at → null', () => {
    const steps: TitrationStepLike[] = [
      { position: 0, dose: 0.5, duration_days: 28, status: 'current', started_at: null },
    ]
    expect(resolveTitrationStageAtFromSteps(steps, DATE_IN_CURRENT)).toBeNull()
  })

  it('dose 0/negativa → null', () => {
    const steps: TitrationStepLike[] = [
      { position: 0, dose: 0, duration_days: 28, status: 'current', started_at: STAGE_START },
    ]
    expect(resolveTitrationStageAtFromSteps(steps, DATE_IN_CURRENT)).toBeNull()
  })

  it('ordena por position antes de caminhar (entrada desordenada)', () => {
    const steps: TitrationStepLike[] = [
      { position: 2, dose: 1.0, duration_days: 28, status: 'upcoming', started_at: null },
      { position: 1, dose: 0.5, duration_days: 28, status: 'current', started_at: STAGE_START },
      { position: 0, dose: 0.25, duration_days: 28, status: 'completed', started_at: null },
    ]
    expect(resolveTitrationStageAtFromSteps(steps, DATE_IN_CURRENT)?.dosage).toBe(0.5)
    expect(resolveTitrationStageAtFromSteps(steps, DATE_NEXT_STAGE)?.dosage).toBe(1.0)
  })
})
