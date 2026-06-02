// _useTodayDerived.test.js — timeline do Hoje ← dose_instances (F4.3b)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

import { renderHook } from '@testing-library/react-native'
import { useTodayDerived } from '../_useTodayDerived'

// "agora" fixo: 2026-05-31 12:00 UTC = 09:00 BRT
const NOW_MS = new Date('2026-05-31T12:00:00.000Z').getTime()
const iso = (offsetMin) => new Date(NOW_MS + offsetMin * 60_000).toISOString()

// `mock`-prefixados (guard de hoisting do jest.mock) e lidos LAZY dentro de
// getRawNow/getTodayLocal (chamados no render, não no load) → sem TDZ. Permite
// o describe de carry-over reposicionar "agora" p/ a madrugada.
let mockNowISO = '2026-05-31T12:00:00.000Z'
let mockToday = '2026-05-31'

jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  getTodayLocal: () => mockToday,
  getRawNow: () => new Date(mockNowISO),
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

const build = (instances, timezone) =>
  renderHook(() =>
    useTodayDerived({ protocols, doseInstances: instances, logs: [], medicines: {}, timezone })
  ).result.current

afterEach(() => {
  jest.clearAllMocks()
  mockNowISO = '2026-05-31T12:00:00.000Z'
  mockToday = '2026-05-31'
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

  it('F4.3f.1: scheduledTime no fuso do perfil (Londres ≠ SP)', () => {
    // NOW_MS = 2026-05-31 12:00 UTC; +30min = 12:30 UTC → Londres (BST) 13:30, SP 09:30.
    expect(build([inst('i1', 30, 'pending')], 'Europe/London').timeline[0].scheduledTime).toBe('13:30')
    expect(build([inst('i1', 30, 'pending')], 'America/Sao_Paulo').timeline[0].scheduledTime).toBe('09:30')
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

  it('timeline NÃO inclui carry-over (ontem é seção própria)', () => {
    // 09:00 BRT: dose de ontem fica fora da janela de hoje e não entra na timeline.
    const { timeline, carryOver } = build([inst('ontem', -24 * 60, 'pending')])
    expect(timeline).toHaveLength(0)
    expect(carryOver).toHaveLength(0) // 24h atrás > tolerância → nem carry-over
  })
})

describe('useTodayDerived — carry-over "Pendências de ontem" (F4.3e)', () => {
  beforeEach(() => {
    // "agora" = 2026-05-31 01:00 BRT (04:00 UTC) — madrugada, p/ ontem ainda no prazo.
    mockNowISO = '2026-05-31T04:00:00.000Z'
    mockToday = '2026-05-31'
  })

  const row = (id, schedUtc, status = 'pending', tol = 120) => ({
    id,
    protocol_id: 'p1',
    scheduled_for: schedUtc,
    status,
    expected_dose: 1,
    tolerance_minutes: tol,
  })

  it('dose de ontem pending dentro da tolerância → carryOver (não timeline)', () => {
    // 2026-05-30 23:30 BRT = 05-31 02:30 UTC → 90min antes, late
    const { timeline, carryOver } = build([row('y1', '2026-05-31T02:30:00.000Z')])
    expect(carryOver).toHaveLength(1)
    expect(carryOver[0].id).toBe('y1')
    expect(carryOver[0].timelineStatus).toBe('ATRASADA')
    expect(timeline).toHaveLength(0)
  })

  it('dose de hoje → timeline (não carryOver)', () => {
    // 2026-05-31 08:00 BRT = 11:00 UTC
    const { timeline, carryOver } = build([row('t1', '2026-05-31T11:00:00.000Z')])
    expect(timeline).toHaveLength(1)
    expect(timeline[0].id).toBe('t1')
    expect(carryOver).toHaveLength(0)
  })

  it('dose de ontem fora da tolerância / já taken → não entra no carryOver', () => {
    const { carryOver } = build([
      row('y2', '2026-05-31T00:00:00.000Z'), // 240min antes > tol 120 → fora
      row('y3', '2026-05-31T02:30:00.000Z', 'taken'), // já tomada → fora
    ])
    expect(carryOver).toHaveLength(0)
  })
})

describe('useTodayDerived — look-ahead "Em breve" (F4.3e bidirecional)', () => {
  beforeEach(() => {
    // "agora" = 2026-05-31 23:30 BRT (2026-06-01 02:30 UTC) — fim do dia.
    mockNowISO = '2026-06-01T02:30:00.000Z'
    mockToday = '2026-05-31'
  })

  const row = (id, schedUtc, status = 'pending', tol = 120) => ({
    id,
    protocol_id: 'p1',
    scheduled_for: schedUtc,
    status,
    expected_dose: 1,
    tolerance_minutes: tol,
  })

  it('dose de amanhã dentro da tolerância → lookAhead (não timeline)', () => {
    // 2026-06-01 00:30 BRT = 03:30 UTC → 60min à frente
    const { timeline, lookAhead } = build([row('a1', '2026-06-01T03:30:00.000Z')])
    expect(lookAhead).toHaveLength(1)
    expect(lookAhead[0].id).toBe('a1')
    expect(timeline).toHaveLength(0)
  })

  it('dose de amanhã longe → não entra no lookAhead', () => {
    // 2026-06-01 09:00 BRT = 12:00 UTC → ~570min > tol 120
    const { lookAhead } = build([row('a2', '2026-06-01T12:00:00.000Z')])
    expect(lookAhead).toHaveLength(0)
  })
})
