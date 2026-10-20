import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * 107 PO-2 — a fila só é alcançável pelo ADMIN_USER_ID: JWT de usuário comum ⇒ 401, sem JWT ⇒ 401
 * (comportamento do admin.ts, verificado no RC-SEC). O handler nunca é chamado nesses casos.
 */

const verifyAdminAccess = vi.fn()
const handleApprovePrune = vi.fn(async (_q, r) => r.status(200).json({ ok: true }))

vi.mock('../../server/utils/auth.js', () => ({ verifyAdminAccess }))
vi.mock('../admin/_handlers/prune.js', () => ({
  handleListPrune: vi.fn(), handleApprovePrune, handleDeferPrune: vi.fn(), handleRevealPrune: vi.fn(),
  handleMarkNoticePrune: vi.fn(), handleGetPruneTexts: vi.fn(), handleUpdatePruneTexts: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))

function res() {
  const r: any = { statusCode: 0, body: null }
  r.status = (c: number) => { r.statusCode = c; return r }
  r.json = (b: any) => { r.body = b; return r }
  return r
}

let handler: any
beforeEach(async () => {
  vi.resetModules()
  process.env.ADMIN_USER_ID = 'b0c9746c-c4d9-4954-a198-59856009be26'
  process.env.SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.SUPABASE_ANON_KEY = 'anon'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  handler = (await import('../admin.js')).default
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.clearAllTimers() })

const req = (auth?: string) => ({
  method: 'POST', query: { resource: 'prune', action: 'approve' }, body: { queue_id: 'q', prefix: 'abcdef' },
  headers: auth ? { authorization: auth } : {},
})

describe('admin.ts resource=prune (PO-2)', () => {
  it('sem JWT e com JWT de usuário comum ⇒ 401; o handler não roda', async () => {
    verifyAdminAccess.mockResolvedValueOnce({ authorized: false, error: 'Missing token' })
    let r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(401)

    verifyAdminAccess.mockResolvedValueOnce({ authorized: false, error: 'Forbidden' })
    r = res()
    await handler(req('Bearer jwt-de-usuario-comum'), r)
    expect(r.statusCode).toBe(401)
    expect(handleApprovePrune).not.toHaveBeenCalled()
  })

  it('admin ⇒ chega ao handler; ação fora da lista ⇒ 405', async () => {
    verifyAdminAccess.mockResolvedValue({ authorized: true })
    let r = res()
    await handler(req('Bearer admin'), r)
    expect(r.statusCode).toBe(200)
    expect(handleApprovePrune).toHaveBeenCalledTimes(1)

    r = res()
    await handler({ ...req('Bearer admin'), query: { resource: 'prune', action: 'approve_all' } }, r)
    expect(r.statusCode).toBe(405)
  })
})
