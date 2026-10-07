import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

const mockCaptureCheckIn = vi.fn((..._a: unknown[]) => 'check-in-1')
vi.mock('@sentry/node-core/light', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, captureCheckIn: (...a: unknown[]) => mockCaptureCheckIn(...a) }
})

const { withServerMonitor, CRITICAL_DELIVERY_AUDIT_MONITOR } = await import('../sentry.js')

const ORIGINAL_DSN = process.env.SENTRY_SERVER_DSN

beforeEach(() => {
  process.env.SENTRY_SERVER_DSN = 'https://key@o0.ingest.sentry.io/0'
})

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  if (ORIGINAL_DSN === undefined) delete process.env.SENTRY_SERVER_DSN
  else process.env.SENTRY_SERVER_DSN = ORIGINAL_DSN
})

// 082 D1 · S-3: sem heartbeat, a ausência do alerta de entrega crítica era ambígua — "tudo certo"
// e "o job morreu" pareciam iguais (nenhum evento em 2026-09-14, sem monitor no Sentry).
describe('withServerMonitor (082 D1 · S-3)', () => {
  it('🔴 job ok ⇒ check-in in_progress com upsert do monitor, depois ok [PO-D1-8]', async () => {
    const result = await withServerMonitor(CRITICAL_DELIVERY_AUDIT_MONITOR, async () => 42)

    expect(result).toBe(42)
    expect(mockCaptureCheckIn).toHaveBeenCalledTimes(2)
    const [start, config] = mockCaptureCheckIn.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>]
    expect(start).toEqual({ monitorSlug: 'critical-delivery-audit', status: 'in_progress' })
    // Espelha o `currentHour === 8 && currentMinute === 0` de api/notify.ts, que roda em São Paulo.
    expect(config).toEqual({
      schedule: { type: 'crontab', value: '0 8 * * *' },
      timezone: 'America/Sao_Paulo',
      checkinMargin: 10,
      maxRuntime: 5,
    })
    expect(mockCaptureCheckIn.mock.calls[1][0]).toMatchObject({
      monitorSlug: 'critical-delivery-audit',
      status: 'ok',
      checkInId: 'check-in-1',
    })
  })

  it('🔴 job lança ⇒ check-in error e o erro REPROPAGA (o runJob isola e reporta)', async () => {
    await expect(
      withServerMonitor(CRITICAL_DELIVERY_AUDIT_MONITOR, async () => {
        throw new Error('banco fora')
      })
    ).rejects.toThrow('banco fora')

    expect(mockCaptureCheckIn.mock.calls[1][0]).toMatchObject({ status: 'error', checkInId: 'check-in-1' })
  })

  it('🔴 SDK lança no check-in ⇒ o job roda igual [PO-D1-8]', async () => {
    mockCaptureCheckIn.mockImplementation(() => {
      throw new Error('sdk quebrado')
    })
    const fn = vi.fn(async () => 'rodou')

    await expect(withServerMonitor(CRITICAL_DELIVERY_AUDIT_MONITOR, fn)).resolves.toBe('rodou')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('sem DSN (dev/test) ⇒ no-op: nenhum check-in, job roda', async () => {
    delete process.env.SENTRY_SERVER_DSN
    const fn = vi.fn(async () => 'rodou')

    await expect(withServerMonitor(CRITICAL_DELIVERY_AUDIT_MONITOR, fn)).resolves.toBe('rodou')
    expect(mockCaptureCheckIn).not.toHaveBeenCalled()
  })
})
