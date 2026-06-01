// _useTodayDerived.test.js — timeline do Hoje ← dose_instances (F4.3b)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { renderHook } from '@testing-library/react-native'
import { useTodayDerived } from '../_useTodayDerived'

// "agora" fixo: 2026-05-31 12:00 UTC = 09:00 BRT
const NOW_MS = new Date('2026-05-31T12:00:00.000Z').getTime()
const iso = (offsetMin) => new Date(NOW_MS + offsetMin * 60_000).toISOString()

jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  getTodayLocal: () => '2026-05-31',
  getRawNow: () => new Date('2026-05-31T12:00:00.000Z'),
}))

const protocols = [
  {
    id: 'p1',
    medicine_id: 'm1',
    medicine: { name: 'Losartana', dosage_per_pill: 50, dosage_unit: 'mg' },
    dosage_per_intake: 1,
    time_schedule: ['09:00'],
    start_date: '2026-01-01',
    end_date: null,
    active: true,
  },
]

const inst = (id, offsetMin, status, toleranceMinutes = 120) => ({
  id,
  protocol_id: 'p1',
  scheduled_for: iso(offsetMin),
  status,
  expected_dose: 1,
  tolerance_minutes: toleranceMinutes,
})

const build = (instances) =>
  renderHook(() =>
    useTodayDerived({ protocols, doseInstances: instances, logs: [], medicines: {} })
  ).result.current

afterEach(() => {
  jest.clearAllMocks()
})

describe('useTodayDerived — timeline ← dose_instances (F4.3b)', () => {
  it('taken → TOMADA + isRegistered', () => {
    const { timeline } = build([inst('i1', -60, 'taken')])
    expect(timeline).toHaveLength(1)
    expect(timeline[0].timelineStatus).toBe('TOMADA')
    expect(timeline[0].isRegistered).toBe(true)
    expect(timeline[0].id).toBe('i1')
    expect(timeline[0].instanceId).toBe('i1')
  })

  it('missed → PERDIDA', () => {
    const { timeline } = build([inst('i1', -200, 'missed')])
    expect(timeline[0].timelineStatus).toBe('PERDIDA')
    expect(timeline[0].isRegistered).toBe(false)
  })

  it('pending atrasada (dentro da tolerância) → ATRASADA', () => {
    const { timeline } = build([inst('i1', -30, 'pending')])
    expect(timeline[0].timelineStatus).toBe('ATRASADA')
  })

  it('pending no instante → PROXIMA', () => {
    const { timeline } = build([inst('i1', 30, 'pending')])
    expect(timeline[0].timelineStatus).toBe('PROXIMA')
  })

  it('pending futuro distante → PLANEJADA', () => {
    const { timeline } = build([inst('i1', 300, 'pending')])
    expect(timeline[0].timelineStatus).toBe('PLANEJADA')
  })

  it('pending pós-tolerância (zona null) → PERDIDA', () => {
    // 100min atrasada com tolerância 90 → fora do actionável
    const { timeline } = build([inst('i1', -100, 'pending', 90)])
    expect(timeline[0].timelineStatus).toBe('PERDIDA')
  })

  it('skipped_* não entra na timeline', () => {
    const { timeline } = build([inst('i1', 0, 'skipped_user'), inst('i2', 10, 'skipped_paused')])
    expect(timeline).toHaveLength(0)
  })

  it('carrega protocol + medicine + scheduledTime para o card', () => {
    const { timeline } = build([inst('i1', 30, 'pending')])
    expect(timeline[0].protocol).toMatchObject({ id: 'p1' })
    expect(timeline[0].medicine).toMatchObject({ name: 'Losartana' })
    expect(timeline[0].scheduledTime).toMatch(/^\d{2}:\d{2}$/)
  })

  it('ordena por horário agendado', () => {
    const { timeline } = build([inst('c', 300, 'pending'), inst('a', -30, 'pending'), inst('b', 30, 'pending')])
    expect(timeline.map((d) => d.id)).toEqual(['a', 'b', 'c'])
  })

  it('filtra ocorrências de outros dias — timeline é só do dia (janela 14d do fetch)', () => {
    const dayMin = 24 * 60
    const { timeline } = build([
      inst('ontem', -dayMin, 'taken'), // ~ontem 09:00
      inst('hoje', 30, 'pending'), // hoje
      inst('amanha', dayMin, 'pending'), // ~amanhã 09:00
    ])
    expect(timeline).toHaveLength(1)
    expect(timeline[0].id).toBe('hoje')
  })

  it('stats vêm de dose_instances (taken/(taken+missed))', () => {
    const { stats } = build([inst('i1', -60, 'taken'), inst('i2', -200, 'missed')])
    expect(stats.taken).toBe(1)
    expect(stats.missed).toBe(1)
    expect(stats.score).toBe(50)
  })
})
