import { describe, it, expect, afterEach, vi } from 'vitest'
import { captureServerEvent } from '../sentry.js'
import { runAccessLogHealth } from '../accessLogHealth.js'

vi.mock('../sentry.js', () => ({ captureServerEvent: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function fakeSupabase(result: { data: unknown; error: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(result) }
}

const logger = { info: vi.fn(), error: vi.fn() }

describe('runAccessLogHealth (spec 106 FR-004)', () => {
  it('lista vazia: não alerta', async () => {
    const supabase = fakeSupabase({ data: [], error: null })
    const problems = await runAccessLogHealth({ supabase, logger, correlationId: 'c1' })
    expect(supabase.rpc).toHaveBeenCalledWith('access_log_health')
    expect(problems).toEqual([])
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it('data null sem erro conta como saudável', async () => {
    const problems = await runAccessLogHealth({ supabase: fakeSupabase({ data: null, error: null }), logger })
    expect(problems).toEqual([])
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it('problema reportado: UM evento com as checagens e o detalhe', async () => {
    const rows = [
      { check_name: 'capture_stalled', detail: 'sessoes_renovadas_24h=5; ultima_linha=nenhuma' },
      { check_name: 'pre_request_missing', detail: 'pgrst.db_pre_request do authenticator não aponta para access_hook.capture_access' },
      { check_name: 'writer_secret_missing', detail: 'segredo ACCESS_LOG_WRITER_DSN_PASSWORD ausente ou vazio no Vault' },
    ]
    await runAccessLogHealth({ supabase: fakeSupabase({ data: rows, error: null }), logger, correlationId: 'c2' })
    expect(captureServerEvent).toHaveBeenCalledTimes(1)
    const [message, context] = vi.mocked(captureServerEvent).mock.calls[0]
    expect(message).toMatch(/Marco Civil/)
    expect(context).toMatchObject({ level: 'error', correlationId: 'c2', job: 'access_log_health' })
    expect(context?.extras).toEqual({ count: 3, items: rows })
  })

  it('🔴 PO-SEC-2: o evento nunca carrega ip nem user_id, mesmo se a RPC devolver campo extra', async () => {
    const rows = [
      {
        check_name: 'purge_failed',
        detail: 'falhas_48h=1',
        ip: '203.0.113.7',
        user_id: '58ff7850-8d96-4db5-9051-0908a115611c',
      },
    ]
    await runAccessLogHealth({ supabase: fakeSupabase({ data: rows, error: null }), logger })
    const serialized = JSON.stringify(vi.mocked(captureServerEvent).mock.calls[0])
    expect(serialized).not.toContain('203.0.113.7')
    expect(serialized).not.toContain('58ff7850')
    expect(serialized).not.toMatch(/"ip"|"user_id"|"userId"/)
  })

  it('erro da RPC lança (o runJob do notify isola e reporta)', async () => {
    const supabase = fakeSupabase({ data: null, error: { message: 'permission denied' } })
    await expect(runAccessLogHealth({ supabase, logger })).rejects.toThrow(/access_log_health/)
    expect(captureServerEvent).not.toHaveBeenCalled()
  })
})
