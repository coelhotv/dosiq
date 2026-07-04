import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getTimelineMock, maybeSingleMock, bioListMock } = vi.hoisted(() => ({
  getTimelineMock: vi.fn((..._args: any[]) => Promise.resolve([])),
  maybeSingleMock: vi.fn(() => Promise.resolve({ data: { timezone: 'America/New_York' }, error: null })),
  bioListMock: vi.fn(() => Promise.resolve([])),
}))

// 012 Fase C / FR-011: timeline mescla biomarcadores (CON-025, adapter web-only).
vi.mock('@features/measures/services/measuresRepo', () => ({
  measuresRepo: { list: bioListMock },
}))

vi.mock('@dosiq/core', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    createTimelineService: vi.fn(() => ({ getTimeline: getTimelineMock })),
  }
})

// Builder de query Supabase encadeável p/ user_settings.timezone
vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
      })),
    })),
  },
  getUserId: vi.fn(() => Promise.resolve('user-123')),
}))

import { getMonthTimeline, getUserTimezone } from '../timelineService'

describe('timelineService (web)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTimelineMock.mockResolvedValue([])
    maybeSingleMock.mockResolvedValue({ data: { timezone: 'America/New_York' }, error: null })
    bioListMock.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('resolve o fuso do usuário de user_settings (fallback SP em erro)', async () => {
    await expect(getUserTimezone('user-123')).resolves.toBe('America/New_York')
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    await expect(getUserTimezone('user-123')).resolves.toBe('America/Sao_Paulo')
  })

  it('injeta o tz resolvido e limites de janela em UTC real no getTimeline (AP-194)', async () => {
    await getMonthTimeline(2026, 4, {}) // maio (month 0-based = 4)
    expect(getTimelineMock).toHaveBeenCalledTimes(1)
    const arg: any = getTimelineMock.mock.calls[0][0]
    expect(arg.userId).toBe('user-123')
    expect(arg.tz).toBe('America/New_York')
    // Limites são ISO UTC (terminam em Z) — janela absoluta, não wall-clock.
    expect(arg.fromTs).toMatch(/Z$/)
    expect(arg.toTs).toMatch(/Z$/)
    expect(new Date(arg.fromTs).getTime()).toBeLessThan(new Date(arg.toTs).getTime())
  })

  it('respeita tz fornecido sem nova query de settings', async () => {
    await getMonthTimeline(2026, 0, { tz: 'Europe/Lisbon' })
    expect(maybeSingleMock).not.toHaveBeenCalled()
    expect((getTimelineMock.mock.calls[0][0] as any).tz).toBe('Europe/Lisbon')
  })

  it('mescla biomarcadores como eventos tipados, ordenados por instante (FR-011)', async () => {
    getTimelineMock.mockResolvedValueOnce([
      { id: 'd1', type: 'dose', occurred_at: '2026-05-10T12:00:00.000Z', payload: {} },
    ])
    bioListMock.mockResolvedValueOnce([
      { id: 'b1', type: 'glicemia', value: 112, value_secondary: null, unit: 'mg/dL', measured_at: '2026-05-10T08:00:00.000Z', context: 'jejum' },
    ])
    const { events } = await getMonthTimeline(2026, 4, { tz: 'America/Sao_Paulo' })
    expect(events).toHaveLength(2)
    // ASC por instante: biomarcador 08:00 antes da dose 12:00.
    expect(events[0].type).toBe('biomarker')
    expect(events[0].id).toBe('bio:b1')
    expect(events[1].type).toBe('dose')
    expect(events[0].localDay).toBe('2026-05-10')
  })

  it('falha de biomarcador não derruba a timeline de dose (aditivo)', async () => {
    getTimelineMock.mockResolvedValueOnce([
      { id: 'd1', type: 'dose', occurred_at: '2026-05-10T12:00:00.000Z', payload: {} },
    ])
    bioListMock.mockRejectedValueOnce(new Error('rls down'))
    const { events } = await getMonthTimeline(2026, 4, { tz: 'America/Sao_Paulo' })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('dose')
  })
})
