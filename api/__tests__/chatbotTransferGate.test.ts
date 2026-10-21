import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * 096 T039 / PO-12 / PO-13 — o assistente só fala com a Groq (EUA) com `international_transfer`
 * vigente. Sem B (flag NULL, linha ausente ou leitura falha) ⇒ 403 `transfer_consent_required` e
 * a Groq NUNCA é instanciada nem chamada — imposto no servidor, independe do cliente (0.30.x).
 */

const groqCreate = vi.fn(async () => ({ choices: [{ message: { content: 'ok' } }] }))
const GroqCtor = vi.fn(function Groq() {
  return { chat: { completions: { create: groqCreate } } }
})
vi.mock('groq-sdk', () => ({ default: GroqCtor }))

let settingsResult: { data: unknown; error: unknown } | Error = { data: null, error: null }
const getUser = vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (settingsResult instanceof Error) throw settingsResult
            return settingsResult
          },
        }),
      }),
    }),
  }),
}))

function res() {
  const r: any = { statusCode: 0, body: null }
  r.status = (c: number) => { r.statusCode = c; return r }
  r.json = (b: any) => { r.body = b; return r }
  r.setHeader = () => r
  return r
}
const req = () => ({
  method: 'POST',
  headers: { authorization: 'Bearer jwt' },
  body: { message: 'Posso tomar com café?', history: [] },
})

let handler: any
beforeEach(async () => {
  vi.resetModules()
  process.env.SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.GROQ_API_KEY = 'groq'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  handler = (await import('../chatbot.js')).default
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.clearAllTimers() })

describe('api/chatbot — gate da caixa B (096)', () => {
  it.each([
    ['flag NULL', { data: { international_transfer_granted_at: null }, error: null }],
    ['linha ausente', { data: null, error: null }],
    ['erro de leitura', { data: null, error: { message: 'timeout' } }],
    ['exceção na leitura', new Error('network')],
  ])('🔴 %s ⇒ 403 transfer_consent_required, Groq 0×', async (_label, result) => {
    settingsResult = result as never
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(403)
    expect(r.body).toEqual({ error: 'transfer_consent_required' })
    expect(GroqCtor).not.toHaveBeenCalled()
    expect(groqCreate).not.toHaveBeenCalled()
  })

  it('com B ⇒ segue até a Groq', async () => {
    settingsResult = { data: { international_transfer_granted_at: '2026-10-21T10:00:00Z' }, error: null }
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).not.toBe(403)
    expect(groqCreate).toHaveBeenCalledTimes(1)
  })

  it('sem JWT continua 401 (o gate de B não muda a ordem: auth primeiro)', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } } as never)
    const r = res()
    await handler(req(), r)
    expect(r.statusCode).toBe(401)
  })
})
