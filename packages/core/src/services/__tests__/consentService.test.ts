import { describe, it, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { createConsentService } from '../consentService'
import { CURRENT_POLICY_VERSION } from '../../schemas/consentSchema'

// 046 Slice A — consentService.
// A invariante que estes testes protegem: a escrita passa por RPC, NUNCA por insert. Se alguém
// trocar o wrapper por `.from('consent_log').insert(...)`, os testes de `grant`/`revoke` caem —
// e caem ANTES de o permission denied aparecer em produção.

const EVENT = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  consent_type: 'health_data' as const,
  action: 'granted' as const,
  policy_version: CURRENT_POLICY_VERSION,
  platform: 'web' as const,
  created_at: '2026-07-14T10:00:00.000Z',
}

/** Client mockado: `rpc` para escrita, cadeia `from().select().eq().order().limit()` para leitura. */
function makeClient(opts?: {
  rpcResult?: unknown
  selectResult?: unknown
}) {
  // Mocks TIPADOS contra a assinatura real — sem os parâmetros declarados, `mock.calls` vira
  // tupla vazia e os asserts sobre os argumentos não compilam no strict island.
  const rpc = vi.fn(
    async (_fn: string, _args: Record<string, unknown>) =>
      opts?.rpcResult ?? { data: EVENT.id, error: null },
  )
  const limit = vi.fn(async (_n: number) => opts?.selectResult ?? { data: [EVENT], error: null })
  const order = vi.fn((_col: string, _opts?: { ascending?: boolean }) => ({ limit }))
  const eq = vi.fn((_col: string, _val: unknown) => ({ order }))
  const select = vi.fn((_columns: string) => ({ eq }))
  const from = vi.fn((_table: string) => ({ select }))
  return {
    client: { rpc, from } as unknown as SupabaseClient<Database>,
    rpc,
    from,
    select,
    eq,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('createConsentService — escrita (RPC, nunca INSERT)', () => {
  it('grant chama a RPC consent_grant e NÃO toca na tabela', async () => {
    const { client, rpc, from } = makeClient()
    const service = createConsentService({ client })

    const result = await service.grant('health_data', 'mobile')

    expect(result).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('consent_grant', {
      p_consent_type: 'health_data',
      p_platform: 'mobile',
    })
    // A prova de que a trilha não é escrita pelo client.
    expect(from).not.toHaveBeenCalled()
  })

  it('revoke chama a RPC consent_revoke e NÃO toca na tabela', async () => {
    const { client, rpc, from } = makeClient()
    const service = createConsentService({ client })

    const result = await service.revoke('health_data', 'web')

    expect(result).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('consent_revoke', {
      p_consent_type: 'health_data',
      p_platform: 'web',
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('o client NUNCA envia policy_version nem subject_hash (quem carimba é o servidor)', async () => {
    const { client, rpc } = makeClient()
    const service = createConsentService({ client })

    await service.grant('terms_privacy', 'web')

    const args = rpc.mock.calls[0]?.[1] ?? {}
    expect(Object.keys(args).sort()).toEqual(['p_consent_type', 'p_platform'])
    expect(args).not.toHaveProperty('p_policy_version')
    expect(args).not.toHaveProperty('p_subject_hash')
    expect(args).not.toHaveProperty('p_action')
  })

  it('erro do RPC (permission denied) vira { ok:false } com a mensagem, sem lançar', async () => {
    const { client } = makeClient({
      rpcResult: { data: null, error: { message: 'permission denied for table consent_log' } },
    })
    const service = createConsentService({ client })

    const result = await service.grant('health_data', 'web')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('permission denied')
  })

  it('AP-216: rpc devolvendo undefined não estoura o destructuring', async () => {
    const { client } = makeClient({ rpcResult: undefined })
    const service = createConsentService({ client })

    await expect(service.grant('health_data', 'web')).resolves.toEqual({ ok: true })
  })

  it('rpc que LANÇA (rede) vira { ok:false }, nunca propaga', async () => {
    const rpc = vi.fn(async () => {
      throw new Error('network down')
    })
    const client = { rpc, from: vi.fn() } as unknown as SupabaseClient<Database>
    const service = createConsentService({ client })

    const result = await service.revoke('health_data', 'mobile')

    expect(result).toEqual({ ok: false, error: 'network down' })
  })
})

describe('createConsentService — getStatus', () => {
  it('deriva granted do último evento, com a versão aceita', async () => {
    const { client, from, select } = makeClient()
    const service = createConsentService({ client })

    const state = await service.getStatus('health_data')

    expect(state.status).toBe('granted')
    expect(state.policyVersion).toBe(CURRENT_POLICY_VERSION)
    expect(state.stale).toBe(false)
    expect(from).toHaveBeenCalledWith('consent_log')
    // S4: o select não pode pedir subject_hash nem user_id — não há grant de coluna pra eles.
    const columns = String(select.mock.calls[0]?.[0] ?? '')
    expect(columns).not.toContain('subject_hash')
    expect(columns).not.toContain('user_id')
  })

  it('NÃO filtra por user_id — quem escopa é a RLS (filtrar daria permission denied)', async () => {
    const { client, eq } = makeClient()
    const service = createConsentService({ client })

    await service.getStatus('health_data')

    const filtered = eq.mock.calls.map((c) => c[0])
    expect(filtered).toEqual(['consent_type'])
    expect(filtered).not.toContain('user_id')
  })

  it('lista vazia → missing (conta anterior ao 046; nada de consentimento retroativo)', async () => {
    const { client } = makeClient({ selectResult: { data: [], error: null } })
    const service = createConsentService({ client })

    const state = await service.getStatus('health_data')

    expect(state).toEqual({ status: 'missing', policyVersion: null, updatedAt: null, stale: false })
  })

  it('último evento é revoked → revoked (mesmo havendo granted anterior)', async () => {
    const { client } = makeClient({
      selectResult: {
        data: [
          { ...EVENT, action: 'revoked', created_at: '2026-07-14T12:00:00.000Z' },
          { ...EVENT, action: 'granted', created_at: '2026-07-14T10:00:00.000Z' },
        ],
        error: null,
      },
    })
    const service = createConsentService({ client })

    const state = await service.getStatus('health_data')

    expect(state.status).toBe('revoked')
  })

  it('granted numa versão antiga → stale (pede re-consentimento)', async () => {
    const { client } = makeClient({
      selectResult: { data: [{ ...EVENT, policy_version: '0.1' }], error: null },
    })
    const service = createConsentService({ client })

    const state = await service.getStatus('health_data')

    expect(state.status).toBe('granted')
    expect(state.stale).toBe(true)
  })

  it('atos do CONTROLADOR não definem o estado do titular', async () => {
    const { client } = makeClient({
      selectResult: {
        data: [
          { ...EVENT, action: 'notice_sent', created_at: '2026-07-14T13:00:00.000Z' },
          { ...EVENT, action: 'granted', created_at: '2026-07-14T10:00:00.000Z' },
        ],
        error: null,
      },
    })
    const service = createConsentService({ client })

    const state = await service.getStatus('health_data')

    expect(state.status).toBe('granted')
  })

  it('erro de leitura NÃO vira revoked (falha de rede não é decisão do titular)', async () => {
    const { client } = makeClient({ selectResult: { data: null, error: { message: 'timeout' } } })
    const service = createConsentService({ client })

    const state = await service.getStatus('health_data')

    expect(state.status).toBe('missing')
    expect(state.status).not.toBe('revoked')
  })
})

describe('createConsentService — materializeSignupIntent', () => {
  it('intenção true + estado missing → grava via RPC', async () => {
    const { client, rpc } = makeClient({ selectResult: { data: [], error: null } })
    const service = createConsentService({ client })

    const result = await service.materializeSignupIntent(
      { health_consent: true, policy_version: CURRENT_POLICY_VERSION },
      'mobile',
    )

    expect(result).toEqual({ materialized: true })
    expect(rpc).toHaveBeenCalledWith('consent_grant', {
      p_consent_type: 'health_data',
      p_platform: 'mobile',
    })
  })

  it('idempotente: já existe granted → não grava de novo', async () => {
    const { client, rpc } = makeClient()
    const service = createConsentService({ client })

    const result = await service.materializeSignupIntent({ health_consent: true }, 'web')

    expect(result).toEqual({ materialized: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('NÃO ressuscita consentimento revogado (metadata velho não desfaz a revogação)', async () => {
    const { client, rpc } = makeClient({
      selectResult: { data: [{ ...EVENT, action: 'revoked' }], error: null },
    })
    const service = createConsentService({ client })

    // O metadata do signup continua lá dizendo `health_consent: true` — mas o titular REVOGOU
    // depois. Materializar aqui reescreveria a vontade dele com um dado de meses atrás.
    const result = await service.materializeSignupIntent({ health_consent: true }, 'web')

    expect(result).toEqual({ materialized: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sem intenção (null/false/undefined) → no-op', async () => {
    const { client, rpc } = makeClient({ selectResult: { data: [], error: null } })
    const service = createConsentService({ client })

    await expect(service.materializeSignupIntent(null, 'web')).resolves.toEqual({ materialized: false })
    await expect(service.materializeSignupIntent({ health_consent: false }, 'web')).resolves.toEqual({
      materialized: false,
    })
    await expect(service.materializeSignupIntent(undefined, 'web')).resolves.toEqual({
      materialized: false,
    })
    expect(rpc).not.toHaveBeenCalled()
  })
})
