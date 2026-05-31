import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getTimelineMock, maybeSingleMock } = vi.hoisted(() => ({
  getTimelineMock: vi.fn(() => Promise.resolve([])),
  maybeSingleMock: vi.fn(() => Promise.resolve({ data: { timezone: 'America/New_York' }, error: null })),
}))

vi.mock('@dosiq/core', async (importOriginal) => {
  const actual = await importOriginal()
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
    const arg = getTimelineMock.mock.calls[0][0]
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
    expect(getTimelineMock.mock.calls[0][0].tz).toBe('Europe/Lisbon')
  })
})
