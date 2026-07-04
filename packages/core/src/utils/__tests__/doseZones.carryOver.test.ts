// 012 Fase B (FR-008b): carry-over multi-dia — dose semanal (tolerância 5040min)
// pendente há 2-3 dias continua actionável no carry-over, com rótulo relativo.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { splitDayTimeline, daysAgoLabel } from '../doseZones'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const TZ = 'America/Sao_Paulo'
// "agora": 2026-06-10 10:00 SP (13:00Z)
const NOW = new Date('2026-06-10T13:00:00.000Z')

const weeklyProtocol = {
  id: 'p-glp1',
  medicine_id: 'm1',
  medicine: { name: 'Semaglutida', type: 'medicamento', dosage_unit: 'mg' },
  dosage_per_intake: 0.25,
}

function inst(overrides) {
  return {
    id: 'di-1',
    protocol_id: 'p-glp1',
    status: 'pending',
    ...overrides,
  }
}

describe('splitDayTimeline — carry-over multi-dia (FR-008b)', () => {
  it('dose semanal de 2 dias atrás, dentro da tolerância 5040 → carryOver', () => {
    // Agendada 2026-06-08 08:00 SP (11:00Z) → atraso = 2d2h = 3000min < 5040
    const out = splitDayTimeline(
      [inst({ scheduled_for: '2026-06-08T11:00:00.000Z', tolerance_minutes: 5040 })],
      [weeklyProtocol],
      { now: NOW, tz: TZ }
    )
    expect(out.carryOver).toHaveLength(1)
    expect(out.today).toHaveLength(0)
  })

  it('dose semanal de 4 dias atrás, FORA da tolerância (5040 < 5880min) → some (não actionável)', () => {
    const out = splitDayTimeline(
      [inst({ scheduled_for: '2026-06-06T11:00:00.000Z', tolerance_minutes: 5040 })],
      [weeklyProtocol],
      { now: NOW, tz: TZ }
    )
    expect(out.carryOver).toHaveLength(0)
  })

  it('dose diária de 2 dias atrás com tolerância 120 → some (regressão: legado intacto)', () => {
    const out = splitDayTimeline(
      [inst({ scheduled_for: '2026-06-08T11:00:00.000Z', tolerance_minutes: 120 })],
      [weeklyProtocol],
      { now: NOW, tz: TZ }
    )
    expect(out.carryOver).toHaveLength(0)
  })

  it('dose multi-dia já taken → não entra no carryOver (não é pendência)', () => {
    const out = splitDayTimeline(
      [inst({ scheduled_for: '2026-06-08T11:00:00.000Z', tolerance_minutes: 5040, status: 'taken' })],
      [weeklyProtocol],
      { now: NOW, tz: TZ }
    )
    expect(out.carryOver).toHaveLength(0)
  })
})

describe('daysAgoLabel (FR-008b)', () => {
  it('mesmo dia local → null (sem rótulo)', () => {
    expect(daysAgoLabel('2026-06-10T11:00:00.000Z', NOW, TZ)).toBeNull()
  })

  it('dia anterior → "ontem" (mesmo com poucas horas de distância)', () => {
    // 2026-06-09 23:00 SP (2026-06-10T02:00Z) visto 10/06 10:00 SP = 11h de distância
    expect(daysAgoLabel('2026-06-10T02:00:00.000Z', NOW, TZ)).toBe('ontem')
  })

  it('2+ dias → "há N dias"', () => {
    expect(daysAgoLabel('2026-06-08T11:00:00.000Z', NOW, TZ)).toBe('há 2 dias')
    expect(daysAgoLabel('2026-06-07T11:00:00.000Z', NOW, TZ)).toBe('há 3 dias')
  })

  it('degenerados → null: futuro, inválido, sem args', () => {
    expect(daysAgoLabel('2026-06-12T11:00:00.000Z', NOW, TZ)).toBeNull()
    expect(daysAgoLabel('not-a-date', NOW, TZ)).toBeNull()
    expect(daysAgoLabel(null, NOW, TZ)).toBeNull()
    expect(daysAgoLabel('2026-06-08T11:00:00.000Z', null, TZ)).toBeNull()
  })
})
