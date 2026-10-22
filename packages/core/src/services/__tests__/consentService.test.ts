import { describe, it, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { createConsentService, CONSENT_READ_TIMEOUT_MS } from '../consentService'
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

  it('erro de leitura LANÇA — não pode virar `missing` (rede que piscou não afirma nada)', async () => {
    const { client } = makeClient({ selectResult: { data: null, error: { message: 'timeout' } } })
    const service = createConsentService({ client })

    await expect(service.getStatus('health_data')).rejects.toThrow(/trilha de consentimento/i)
  })

  it('resposta sem data também lança (não silencia como `missing`)', async () => {
    const { client } = makeClient({ selectResult: { data: null, error: null } })
    const service = createConsentService({ client })

    await expect(service.getStatus('health_data')).rejects.toThrow(/sem dados/i)
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

  it('falha de LEITURA não pode virar concessão (o furo do review — consentimento revogado ressuscitado)', async () => {
    // Cenário: o titular REVOGOU meses atrás, mas o `user_metadata` do signup ainda diz
    // `health_consent: true`. Se a leitura da trilha falhar por rede e virar `missing`, a
    // materialização concede de novo — reescrevendo a vontade do titular com um dado velho.
    const { client, rpc } = makeClient({
      selectResult: { data: null, error: { message: 'network timeout' } },
    })
    const service = createConsentService({ client })

    const result = await service.materializeSignupIntent({ health_consent: true }, 'mobile')

    expect(result).toEqual({ materialized: false })
    // A prova: nenhuma escrita saiu no escuro.
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

// Spec 096 (T051) — o signup v0.4 grava A + termos (+ B se marcada). Leitura por TIPO: o estado de
// B é independente do de A, então o mock responde conforme o `consent_type` filtrado.
function makeTypedClient(byType: Record<string, unknown>) {
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: EVENT.id, error: null }))
  const from = vi.fn((_table: string) => ({
    select: (_c: string) => ({
      eq: (_col: string, type: string) => ({
        order: () => ({ limit: async () => byType[type] ?? { data: [], error: null } }),
      }),
    }),
  }))
  return { client: { rpc, from } as unknown as SupabaseClient<Database>, rpc }
}

describe('createConsentService — materializeSignupIntent v0.4 (096)', () => {
  const grantedTypes = (rpc: ReturnType<typeof makeTypedClient>['rpc']) =>
    rpc.mock.calls.map((c) => [c[0], c[1].p_consent_type])

  it('A + B marcadas → grava health_data, terms_privacy e international_transfer', async () => {
    const { client, rpc } = makeTypedClient({})
    const result = await createConsentService({ client }).materializeSignupIntent(
      { health_consent: true, transfer_consent: true },
      'web',
    )
    expect(result).toEqual({ materialized: true })
    expect(grantedTypes(rpc)).toEqual([
      ['consent_grant', 'health_data'],
      ['consent_grant', 'terms_privacy'],
      ['consent_grant', 'international_transfer'],
    ])
  })

  it('terms_privacy falha → 1 nova tentativa; A segue materializada (RC6 #898)', async () => {
    const { client, rpc } = makeTypedClient({})
    let termsCalls = 0
    rpc.mockImplementation(async (_fn: string, args: Record<string, unknown>) => {
      // Cast: o mock tipado só aceita o formato de sucesso; a falha é exatamente o caso deste teste.
      if (args.p_consent_type === 'terms_privacy' && termsCalls++ === 0) {
        return { data: null, error: { message: 'net' } } as unknown as { data: string; error: null }
      }
      return { data: EVENT.id, error: null }
    })
    const result = await createConsentService({ client }).materializeSignupIntent({ health_consent: true }, 'web')
    expect(result).toEqual({ materialized: true })
    expect(grantedTypes(rpc)).toEqual([
      ['consent_grant', 'health_data'],
      ['consent_grant', 'terms_privacy'],
      ['consent_grant', 'terms_privacy'],
    ])
  })

  it('só A → B nunca é gravada (opcional, guarda 4)', async () => {
    const { client, rpc } = makeTypedClient({})
    await createConsentService({ client }).materializeSignupIntent({ health_consent: true }, 'web')
    expect(grantedTypes(rpc)).toEqual([
      ['consent_grant', 'health_data'],
      ['consent_grant', 'terms_privacy'],
    ])
  })

  it('B já revogada → intenção velha não ressuscita B', async () => {
    const { client, rpc } = makeTypedClient({
      international_transfer: { data: [{ ...EVENT, consent_type: 'international_transfer', action: 'revoked' }], error: null },
    })
    await createConsentService({ client }).materializeSignupIntent({ health_consent: true, transfer_consent: true }, 'web')
    expect(grantedTypes(rpc)).not.toContainEqual(['consent_grant', 'international_transfer'])
  })

  it('leitura de B falha → não grava B, A segue materializada', async () => {
    const { client, rpc } = makeTypedClient({
      international_transfer: { data: null, error: { message: 'network timeout' } },
    })
    const result = await createConsentService({ client }).materializeSignupIntent(
      { health_consent: true, transfer_consent: true },
      'web',
    )
    expect(result).toEqual({ materialized: true })
    expect(grantedTypes(rpc)).not.toContainEqual(['consent_grant', 'international_transfer'])
  })

  it('grant de A falha → nada mais é gravado', async () => {
    const { client, rpc } = makeTypedClient({})
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never)
    const result = await createConsentService({ client }).materializeSignupIntent(
      { health_consent: true, transfer_consent: true },
      'web',
    )
    expect(result).toEqual({ materialized: false })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

// 096 B3 (C-B3-10): uma visita à Privacidade gerava ~15 GETs idênticos em 4 s — gate, 3 bridges de
// supressão, seção e cartão, cada um com a sua instância do serviço. E uma leitura presa deixava o
// spinner girando 1 min.
describe('createConsentService — leitura reaproveitada e teto de tempo', () => {
  it('instâncias do MESMO client compartilham a leitura do mesmo tipo', async () => {
    const { client, from } = makeClient()
    const a = createConsentService({ client })
    const b = createConsentService({ client })

    await Promise.all([a.getStatus('health_data'), b.getStatus('health_data'), a.getStatus('health_data')])

    expect(from).toHaveBeenCalledTimes(1)
  })

  it('tipos diferentes não se misturam', async () => {
    const { client, from, eq } = makeClient()
    const service = createConsentService({ client })

    await service.getStatus('health_data')
    await service.getStatus('international_transfer')

    expect(from).toHaveBeenCalledTimes(2)
    expect(eq.mock.calls.map((c) => c[1])).toEqual(['health_data', 'international_transfer'])
  })

  it('escrita invalida: a leitura seguinte vai ao banco', async () => {
    const { client, from } = makeClient()
    const service = createConsentService({ client })

    await service.getStatus('international_transfer')
    await service.grant('international_transfer', 'mobile')
    await service.getStatus('international_transfer')

    expect(from).toHaveBeenCalledTimes(2)
  })

  it('falha não fica guardada: "tentar de novo" vai ao banco', async () => {
    const { client, from } = makeClient({ selectResult: { data: null, error: { message: 'net' } } })
    const service = createConsentService({ client })

    await expect(service.getStatus('health_data')).rejects.toThrow()
    await expect(service.getStatus('health_data')).rejects.toThrow()

    expect(from).toHaveBeenCalledTimes(2)
  })

  it('leitura que não volta LANÇA no teto, em vez de pendurar', async () => {
    vi.useFakeTimers()
    try {
      const { client, from } = makeClient()
      const limit = vi.fn(() => new Promise(() => {}))
      from.mockReturnValue({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) } as never)
      const service = createConsentService({ client })

      const pending = service.getStatus('health_data')
      const assertion = expect(pending).rejects.toThrow('tempo esgotado')
      await vi.advanceTimersByTimeAsync(CONSENT_READ_TIMEOUT_MS)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
