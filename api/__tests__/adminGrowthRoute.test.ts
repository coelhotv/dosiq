import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * 115 — resource=growth do admin.ts.
 * PO-115-5: sem JWT / JWT comum ⇒ 401 e a RPC nunca roda.
 * PO-115-3: payload repassado da RPC, sem token de push nem nome de medicamento.
 * PO-115-8: GROWTH_EXCLUDED_USER_IDS vira p_excluded_user_ids (vazia/ausente ⇒ [], inválido descartado).
 * PO-SEC-3: Cache-Control no-store; erro da RPC ⇒ 500 genérico, sem details e sem payload no log.
 */

const verifyAdminAccess = vi.fn()
const rpc = vi.fn()

vi.mock('../../server/utils/auth.js', () => ({ verifyAdminAccess }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }))
// admin.ts → retry/DLQ → dispatcher → client Supabase do servidor, que LANÇA no import sem env.
vi.mock('../../server/services/supabase.js', () => ({ supabase: {} }))

const X = '11111111-1111-4111-8111-111111111111'
const Y = '22222222-2222-4222-8222-222222222222'

const PAYLOAD = {
  excluded_count: 1,
  total_users: 1,
  users: [{ user_id: Y, email: 'y@fixture.test', treatments: [{ protocol_name: 'T', therapeutic_class: 'Antidiabeticos' }] }],
}

function res() {
  const r: any = { statusCode: 0, body: null, headers: {} as Record<string, string> }
  r.status = (c: number) => { r.statusCode = c; return r }
  r.json = (b: any) => { r.body = b; return r }
  r.setHeader = (k: string, v: string) => { r.headers[k.toLowerCase()] = v; return r }
  return r
}

const req = (auth?: string, extra: Record<string, any> = {}) => ({
  method: 'GET',
  query: { resource: 'growth', ...extra },
  headers: auth ? { authorization: auth } : {},
})

let handler: any
let consoleError: any
beforeEach(async () => {
  vi.resetModules()
  process.env.ADMIN_USER_ID = 'b0c9746c-c4d9-4954-a198-59856009be26'
  process.env.SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.SUPABASE_ANON_KEY = 'anon'
  delete process.env.GROWTH_EXCLUDED_USER_IDS
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  rpc.mockResolvedValue({ data: PAYLOAD, error: null })
  handler = (await import('../admin.js')).default
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.clearAllTimers() })

describe('admin.ts resource=growth — autorização (PO-115-5)', () => {
  it('sem JWT e com JWT de usuário comum ⇒ 401; a RPC não roda', async () => {
    verifyAdminAccess.mockResolvedValueOnce({ authorized: false, error: 'Missing token' })
    let r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(401)

    verifyAdminAccess.mockResolvedValueOnce({ authorized: false, error: 'Forbidden' })
    r = res()
    await handler(req('Bearer jwt-de-usuario-comum'), r)
    expect(r.statusCode).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('admin com método diferente de GET ⇒ 405, sem RPC', async () => {
    verifyAdminAccess.mockResolvedValue({ authorized: true })
    const r = res()
    await handler({ ...req('Bearer admin'), method: 'POST' }, r)
    expect(r.statusCode).toBe(405)
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('admin.ts resource=growth — resposta (PO-115-3, PO-SEC-3)', () => {
  beforeEach(() => { verifyAdminAccess.mockResolvedValue({ authorized: true }) })

  it('200 com o payload da RPC e Cache-Control no-store', async () => {
    const r = res()
    await handler(req('Bearer admin'), r)
    expect(r.statusCode).toBe(200)
    expect(r.body).toEqual(PAYLOAD)
    expect(r.headers['cache-control']).toBe('no-store')
    expect(rpc).toHaveBeenCalledWith('get_admin_growth_analytics', { p_limit: 100, p_offset: 0, p_excluded_user_ids: [] })
  })

  it('não repassa token de push nem nome de medicamento, mesmo se a RPC devolvesse', async () => {
    rpc.mockResolvedValueOnce({
      data: { ...PAYLOAD, users: [{ ...PAYLOAD.users[0], push_token: 'ExponentPushToken[x]', treatments: [{ protocol_name: 'T', name: 'Ozempic' }] }] },
      error: null,
    })
    const r = res()
    await handler(req('Bearer admin'), r)
    const text = JSON.stringify(r.body)
    expect(text).not.toContain('ExponentPushToken')
    expect(text).not.toContain('push_token')
    expect(text).not.toContain('Ozempic')
    expect(text).toContain('protocol_name')
  })

  it('limit/offset vêm limitados: 1..500 e offset ≥ 0; lixo vira default', async () => {
    let r = res()
    await handler(req('Bearer admin', { limit: '9999', offset: '-3' }), r)
    expect(rpc).toHaveBeenLastCalledWith('get_admin_growth_analytics', expect.objectContaining({ p_limit: 500, p_offset: 0 }))
    r = res()
    await handler(req('Bearer admin', { limit: 'abc', offset: '20' }), r)
    expect(rpc).toHaveBeenLastCalledWith('get_admin_growth_analytics', expect.objectContaining({ p_limit: 100, p_offset: 20 }))
    r = res()
    await handler(req('Bearer admin', { limit: '0' }), r)
    expect(rpc).toHaveBeenLastCalledWith('get_admin_growth_analytics', expect.objectContaining({ p_limit: 1 }))
  })

  it('erro da RPC ⇒ 500 genérico, sem details, e o log não leva payload nem e-mail', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'permission denied', details: 'segredo y@fixture.test' } })
    const r = res()
    await handler(req('Bearer admin'), r)
    expect(r.statusCode).toBe(500)
    expect(r.body).toEqual({ error: 'Falha ao carregar analytics' })
    const logged = JSON.stringify(consoleError.mock.calls)
    expect(logged).toContain('42501')
    expect(logged).not.toContain('y@fixture.test')
  })

  it('exceção lançada pelo client ⇒ 500 genérico', async () => {
    rpc.mockRejectedValueOnce(new Error('fetch failed'))
    const r = res()
    await handler(req('Bearer admin'), r)
    expect(r.statusCode).toBe(500)
    expect(r.body).toEqual({ error: 'Falha ao carregar analytics' })
  })
})

describe('GROWTH_EXCLUDED_USER_IDS (PO-115-8 / FR-009)', () => {
  beforeEach(() => { verifyAdminAccess.mockResolvedValue({ authorized: true }) })

  const excludedSent = () => rpc.mock.calls.at(-1)?.[1].p_excluded_user_ids

  it('ausente e vazia ⇒ []', async () => {
    await handler(req('Bearer admin'), res())
    expect(excludedSent()).toEqual([])
    process.env.GROWTH_EXCLUDED_USER_IDS = '  ,  '
    await handler(req('Bearer admin'), res())
    expect(excludedSent()).toEqual([])
  })

  it('lista com espaços e caixa mista é normalizada; inválido é descartado com log', async () => {
    process.env.GROWTH_EXCLUDED_USER_IDS = ` ${X.toUpperCase()} , nao-e-uuid, ${Y},${Y}`
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = res()
    await handler(req('Bearer admin'), r)
    expect(excludedSent()).toEqual([X, Y])
    expect(JSON.stringify(warn.mock.calls)).toContain('1')
    expect(r.statusCode).toBe(200)
  })
})
