import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * 026 Slice 2A — PO-2A-1 (payload fechado), PO-2A-3 (exclusão pela lápide, 404/5xx/429/deadline),
 * PO-SEC-3 (nenhum e-mail no resultado, no capture ou no log) + contrato do cliente Brevo verificado
 * na API real em 2026-10-29 (analysis-2a.md).
 */

const logs: unknown[][] = []
vi.mock('../../../server/bot/logger.js', () => ({
  createLogger: () => ({
    info: (...a: unknown[]) => logs.push(a),
    warn: (...a: unknown[]) => logs.push(a),
    error: (...a: unknown[]) => logs.push(a),
    debug: (...a: unknown[]) => logs.push(a),
  }),
}))

import {
  runBrevoContactsSync,
  buildContactPayload,
  BREVO_ALLOWED_ATTRIBUTES,
  type Candidate,
} from '../brevoContactsSync.js'
import { BrevoError, createBrevoClient, type BrevoClient } from '../brevoClient.js'

const UID_A = '11111111-1111-4111-8111-111111111111'
const UID_B = '22222222-2222-4222-8222-222222222222'
const UID_DEL = '33333333-3333-4333-8333-333333333333'
const EMAIL_A = 'paciente.a@exemplo.com'
const EMAIL_B = 'paciente.b@exemplo.com'

const ENV = { BREVO_API_KEY: 'chave', BREVO_LIST_NEW_USERS: '5', BREVO_SYNC_START: '2026-10-29T00:00:00-03:00' }
const NOW = new Date('2026-10-30T15:00:00Z')

const cand = (user_id: string, email: string, has_app = true): Candidate =>
  ({ user_id, email, created_at: '2026-10-30T01:30:00Z', has_app })

function fakeSupabase(opts: {
  candidates?: Candidate[]
  tombstones?: string[]
  mark?: (uid: string) => number
  fail?: string[]
} = {}) {
  const calls: Array<{ fn: string; args: any }> = []
  return {
    calls,
    supabase: {
      rpc: async (fn: string, args: any) => {
        calls.push({ fn, args })
        if (opts.fail?.includes(fn)) return { data: null, error: { message: `boom ${EMAIL_A}` } }
        if (fn === 'brevo_sync_candidates') return { data: opts.candidates ?? [], error: null }
        if (fn === 'brevo_mark_synced') return { data: opts.mark ? opts.mark(args.p_user_id) : 1, error: null }
        if (fn === 'brevo_deleted_since') return { data: (opts.tombstones ?? []).map((user_id) => ({ user_id })), error: null }
        return { data: null, error: { message: 'rpc desconhecida' } }
      },
    },
  }
}

function fakeBrevo(behavior: { upsert?: (email: string) => void; del?: (id: string) => void } = {}) {
  const upserts: any[] = []
  const deletes: string[] = []
  const brevo: BrevoClient = {
    upsertContact: async (c) => { upserts.push(c); behavior.upsert?.(c.email) },
    deleteByExtId: async (id) => { deletes.push(id); behavior.del?.(id) },
  }
  return { brevo, upserts, deletes }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  logs.length = 0
})

describe('PO-2A-1 — payload fechado (INV-2A-1)', () => {
  it('chaves do payload e dos atributos = lista permitida', () => {
    const p = buildContactPayload(cand(UID_A, EMAIL_A), 5)
    expect(Object.keys(p).sort()).toEqual(['attributes', 'email', 'extId', 'listIds'])
    expect(Object.keys(p.attributes).sort()).toEqual([...BREVO_ALLOWED_ATTRIBUTES].sort())
    expect(BREVO_ALLOWED_ATTRIBUTES).toEqual(['HAS_APP', 'SIGNUP_DATE'])
    expect(p).toEqual({ email: EMAIL_A, extId: UID_A, attributes: { HAS_APP: true, SIGNUP_DATE: '2026-10-29' }, listIds: [5] })
  })

  it('SIGNUP_DATE no fuso de São Paulo e HAS_APP estritamente booleano', () => {
    const p = buildContactPayload({ ...cand(UID_A, EMAIL_A, null as any), created_at: '2026-10-30T03:30:00Z' }, 5)
    expect(p.attributes).toEqual({ HAS_APP: false, SIGNUP_DATE: '2026-10-30' })
  })

  it('o upsert do job envia exatamente o payload montado', async () => {
    const { supabase } = fakeSupabase({ candidates: [cand(UID_A, EMAIL_A, false)] })
    const { brevo, upserts } = fakeBrevo()
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW })
    expect(upserts).toEqual([buildContactPayload(cand(UID_A, EMAIL_A, false), 5)])
    expect(r.included).toBe(1)
  })
})

describe('E1 inclusão — marca só após 2xx (FR-2A-05, C-2A-1)', () => {
  it('erro da Brevo não marca, não lança e segue para a próxima', async () => {
    const { supabase, calls } = fakeSupabase({ candidates: [cand(UID_A, EMAIL_A), cand(UID_B, EMAIL_B)] })
    const { brevo } = fakeBrevo({ upsert: (e) => { if (e === EMAIL_A) throw new BrevoError(500, null) } })
    const capture = vi.fn()
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW, capture })
    expect(calls.filter((c) => c.fn === 'brevo_mark_synced').map((c) => c.args.p_user_id)).toEqual([UID_B])
    expect(r).toMatchObject({ included: 1, includeFailed: 1, stoppedBy: null })
    expect(capture).toHaveBeenCalledWith(expect.any(BrevoError), expect.objectContaining({ job: 'brevo_contacts_sync', etapa: 'include', status: 500 }))
  })

  it('mark 0 = já marcada (concorrência, sem alerta); mark -1 = sem user_settings ⇒ capture', async () => {
    const { supabase } = fakeSupabase({ candidates: [cand(UID_A, EMAIL_A), cand(UID_B, EMAIL_B)], mark: (u) => (u === UID_A ? 0 : -1) })
    const capture = vi.fn()
    const r = await runBrevoContactsSync({ supabase, brevo: fakeBrevo().brevo, env: ENV, now: NOW, capture })
    expect(r).toMatchObject({ included: 0, alreadyMarked: 1, markMissing: 1 })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture.mock.calls[0][1]).toMatchObject({ etapa: 'mark' })
  })

  it('passa BREVO_SYNC_START e o lote de 50 para a RPC', async () => {
    const { supabase, calls } = fakeSupabase()
    await runBrevoContactsSync({ supabase, brevo: fakeBrevo().brevo, env: ENV, now: NOW })
    expect(calls[0]).toEqual({ fn: 'brevo_sync_candidates', args: { p_since: '2026-10-29T03:00:00.000Z', p_limit: 50 } })
  })
})

describe('PO-2A-3 — exclusão espelhada pela lápide', () => {
  it('user_id da lápide ⇒ DELETE por ext_id; janela de 48 h', async () => {
    const { supabase, calls } = fakeSupabase({ tombstones: [UID_DEL] })
    const { brevo, deletes } = fakeBrevo()
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW })
    expect(deletes).toEqual([UID_DEL])
    expect(calls.find((c) => c.fn === 'brevo_deleted_since')?.args).toEqual({ p_since: '2026-10-28T15:00:00.000Z' })
    expect(r).toMatchObject({ tombstones: 1, deleted: 1, deleteFailed: 0 })
  })

  it('5xx no DELETE não lança e vai ao capture', async () => {
    const { supabase } = fakeSupabase({ tombstones: [UID_DEL, UID_A] })
    const { brevo, deletes } = fakeBrevo({ del: (id) => { if (id === UID_DEL) throw new BrevoError(503, null) } })
    const capture = vi.fn()
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW, capture })
    expect(deletes).toEqual([UID_DEL, UID_A])
    expect(r).toMatchObject({ deleted: 1, deleteFailed: 1 })
    expect(capture.mock.calls[0][1]).toMatchObject({ etapa: 'delete', status: 503 })
  })

  it('429 encerra a rodada inteira com stoppedBy (E2 não roda)', async () => {
    const { supabase, calls } = fakeSupabase({ candidates: [cand(UID_A, EMAIL_A), cand(UID_B, EMAIL_B)], tombstones: [UID_DEL] })
    const { brevo, upserts, deletes } = fakeBrevo({ upsert: () => { throw new BrevoError(429, 'too_many_requests') } })
    const capture = vi.fn()
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW, capture })
    expect(upserts).toHaveLength(1)
    expect(deletes).toEqual([])
    expect(calls.some((c) => c.fn === 'brevo_deleted_since')).toBe(false)
    expect(r.stoppedBy).toBe('429')
    expect(capture).not.toHaveBeenCalled()
  })

  it('429 no DELETE para a etapa', async () => {
    const { supabase } = fakeSupabase({ tombstones: [UID_DEL, UID_A] })
    const { brevo, deletes } = fakeBrevo({ del: () => { throw new BrevoError(429, null) } })
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW })
    expect(deletes).toHaveLength(1)
    expect(r.stoppedBy).toBe('429')
  })

  it('deadline de 45 s encerra com stoppedBy antes da próxima chamada', async () => {
    const { supabase } = fakeSupabase({ candidates: [cand(UID_A, EMAIL_A), cand(UID_B, EMAIL_B)], tombstones: [UID_DEL] })
    let t = 0
    const { brevo, upserts, deletes } = fakeBrevo({ upsert: () => { t += 46_000 } })
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW, clock: () => t })
    expect(upserts).toHaveLength(1)
    expect(deletes).toEqual([])
    expect(r).toMatchObject({ included: 1, stoppedBy: 'deadline' })
  })

  it('limita 100 exclusões por rodada', async () => {
    const ids = Array.from({ length: 130 }, (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`)
    const { supabase } = fakeSupabase({ tombstones: ids })
    const { brevo, deletes } = fakeBrevo()
    await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW })
    expect(deletes).toHaveLength(100)
  })
})

describe('config e falha de RPC', () => {
  it.each([
    ['sem chave', { ...ENV, BREVO_API_KEY: '' }],
    ['lista não numérica', { ...ENV, BREVO_LIST_NEW_USERS: 'abc' }],
    ['lista zero', { ...ENV, BREVO_LIST_NEW_USERS: '0' }],
    ['start ausente', { ...ENV, BREVO_SYNC_START: undefined }],
    ['start inválido', { ...ENV, BREVO_SYNC_START: 'ontem' }],
  ])('%s ⇒ aborted config, nenhuma chamada', async (_n, env) => {
    const { supabase, calls } = fakeSupabase({ candidates: [cand(UID_A, EMAIL_A)] })
    const r = await runBrevoContactsSync({ supabase, brevo: fakeBrevo().brevo, env, now: NOW })
    expect(r.aborted).toBe('config')
    expect(calls).toEqual([])
  })

  it('RPC de candidatas falha ⇒ aborted rpc (5xx no ops) mas a exclusão ainda roda', async () => {
    const { supabase } = fakeSupabase({ fail: ['brevo_sync_candidates'], tombstones: [UID_DEL] })
    const { brevo, deletes } = fakeBrevo()
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW })
    expect(r.aborted).toBe('rpc')
    expect(deletes).toEqual([UID_DEL])
  })
})

describe('PO-SEC-3 — nenhum e-mail sai do job', () => {
  it('resultado, capture e logger sem e-mail mesmo com erro que ecoa o endereço', async () => {
    const { supabase } = fakeSupabase({ candidates: [cand(UID_A, EMAIL_A), cand(UID_B, EMAIL_B)], tombstones: [UID_DEL], fail: ['brevo_mark_synced'] })
    // fetch fake: upsert de A = 400 com body ecoando o e-mail; DELETE = 500
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : {}
      if (init.method === 'POST' && body.email === EMAIL_A) {
        return new Response(JSON.stringify({ code: 'invalid_parameter', message: `email ${EMAIL_A} is invalid` }), { status: 400 })
      }
      if (init.method === 'DELETE') return new Response(JSON.stringify({ message: `falha ${EMAIL_B}` }), { status: 500 })
      return new Response(JSON.stringify({ id: 1 }), { status: 201 })
    })
    const brevo = createBrevoClient('chave', fetchFn as any)
    const capture = vi.fn()
    const r = await runBrevoContactsSync({ supabase, brevo, env: ENV, now: NOW, capture, correlationId: 'c-1' })
    expect(r).toMatchObject({ includeFailed: 1, markMissing: 1, deleteFailed: 1 })
    const dump = JSON.stringify([r, capture.mock.calls.map(([e, ctx]) => [String(e), (e as Error).message, ctx]), logs])
    expect(dump).not.toContain('@')
    expect(dump).not.toContain(EMAIL_A)
    expect(dump).not.toContain(EMAIL_B)
  })
})

describe('cliente Brevo (contrato verificado 2026-10-29)', () => {
  const ok = (status = 201) => new Response(status === 204 ? null : '{}', { status })
  const contact = { email: EMAIL_A, extId: UID_A, attributes: { HAS_APP: true }, listIds: [5] }

  it('POST com updateEnabled e ext_id', async () => {
    const fetchFn = vi.fn(async () => ok())
    await createBrevoClient('k', fetchFn as any).upsertContact(contact)
    const [url, init] = fetchFn.mock.calls[0] as any
    expect(url).toBe('https://api.brevo.com/v3/contacts')
    expect(init.headers['api-key']).toBe('k')
    expect(JSON.parse(init.body)).toEqual({ email: EMAIL_A, ext_id: UID_A, attributes: { HAS_APP: true }, listIds: [5], updateEnabled: true })
  })

  it('400 duplicate_parameter ⇒ PUT por ext_id com EMAIL novo (C-2A-2)', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'duplicate_parameter' }), { status: 400 }))
      .mockResolvedValueOnce(ok(204))
    await createBrevoClient('k', fetchFn as any).upsertContact(contact)
    const [url, init] = fetchFn.mock.calls[1] as any
    expect(init.method).toBe('PUT')
    expect(url).toBe(`https://api.brevo.com/v3/contacts/${UID_A}?identifierType=ext_id`)
    expect(JSON.parse(init.body)).toEqual({ attributes: { HAS_APP: true, EMAIL: EMAIL_A }, listIds: [5] })
  })

  it('outro 400 lança BrevoError só com status e code, sem o body', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ code: 'invalid_parameter', message: `x ${EMAIL_A}` }), { status: 400 }))
    const err = await createBrevoClient('k', fetchFn as any).upsertContact(contact).catch((e) => e)
    expect(err).toBeInstanceOf(BrevoError)
    expect({ status: err.status, code: err.code }).toEqual({ status: 400, code: 'invalid_parameter' })
    expect(err.message).not.toContain('@')
  })

  it('DELETE: 204 ok, 404 ok, 500 lança', async () => {
    const del = (s: number) => createBrevoClient('k', vi.fn(async () => new Response(s === 204 ? null : '{}', { status: s })) as any).deleteByExtId(UID_A)
    await expect(del(204)).resolves.toBeUndefined()
    await expect(del(404)).resolves.toBeUndefined()
    await expect(del(500)).rejects.toMatchObject({ status: 500 })
  })

  it('ext_id fora do formato uuid é recusado antes de montar a URL (S-8)', async () => {
    const fetchFn = vi.fn()
    await expect(createBrevoClient('k', fetchFn as any).deleteByExtId('../account')).rejects.toMatchObject({ code: 'invalid_ext_id' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('falha de rede vira BrevoError(0, network) sem a mensagem original', async () => {
    const fetchFn = vi.fn(async () => { throw new Error(`socket ${EMAIL_A}`) })
    const err = await createBrevoClient('k', fetchFn as any).upsertContact(contact).catch((e) => e)
    expect({ status: err.status, code: err.code }).toEqual({ status: 0, code: 'network' })
    expect(err.message).not.toContain('@')
  })
})
