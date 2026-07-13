// createProfileRepository.stockTracking.test.ts — spec 044 T003
//
// Preferência GLOBAL de controle de estoque (user_settings.stock_tracking_enabled /
// .stock_paused_at). Foco no FAIL-SAFE: ausência de dado NUNCA desliga o estoque (FR-009,
// espelho client-side do AP-277).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createProfileRepository } from '../createProfileRepository'

function makeClient(result: any) {
  const builder: any = {
    _calls: [] as any[],
    select: vi.fn(function (...a: any[]) { builder._calls.push(['select', a]); return builder }),
    upsert: vi.fn(function (...a: any[]) { builder._calls.push(['upsert', a]); return builder }),
    eq: vi.fn(function (...a: any[]) { builder._calls.push(['eq', a]); return builder }),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }
  return {
    _builder: builder,
    _from: null as any,
    from: vi.fn(function (table: string) { this._from = table; return builder }),
    rpc: vi.fn(),
  } as any
}

const FAKE_USER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const getUserId = async () => FAKE_USER

describe('createProfileRepository — preferência de estoque (044)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('getStockTracking', () => {
    it('lê stock_tracking_enabled + stock_paused_at de user_settings', async () => {
      const client = makeClient({ data: { stock_tracking_enabled: false, stock_paused_at: '2026-06-01T10:00:00Z' }, error: null })
      const repo = createProfileRepository({ client, getUserId })

      const pref = await repo.getStockTracking()

      expect(client._from).toBe('user_settings')
      expect(client._builder.select).toHaveBeenCalledWith('stock_tracking_enabled, stock_paused_at')
      expect(pref).toEqual({ stock_tracking_enabled: false, stock_paused_at: '2026-06-01T10:00:00Z' })
    })

    it('FAIL-SAFE: sem linha em user_settings → estoque ATIVO (nunca desliga por omissão)', async () => {
      const client = makeClient({ data: null, error: null })
      const pref = await createProfileRepository({ client, getUserId }).getStockTracking()
      expect(pref).toEqual({ stock_tracking_enabled: true, stock_paused_at: null })
    })

    it('erro do Supabase propaga (não mascara como "off")', async () => {
      const client = makeClient({ data: null, error: new Error('boom') })
      await expect(createProfileRepository({ client, getUserId }).getStockTracking()).rejects.toThrow('boom')
    })
  })

  describe('setStockTracking', () => {
    it('off → carimba stock_paused_at (congelamento), sem tocar saldo', async () => {
      const client = makeClient({ data: { stock_tracking_enabled: false, stock_paused_at: '2026-07-11T12:00:00Z' }, error: null })
      const repo = createProfileRepository({ client, getUserId })

      await repo.setStockTracking(false)

      const [payload, options] = client._builder.upsert.mock.calls[0]
      expect(payload.user_id).toBe(FAKE_USER)
      expect(payload.stock_tracking_enabled).toBe(false)
      expect(payload.stock_paused_at).toEqual(expect.any(String))
      expect(options).toEqual({ onConflict: 'user_id' })
      // Nenhum RPC de estoque: opt-out CONGELA (NC3), não muta saldo/compras.
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('off com freeze:false → NÃO carimba (escolha do onboarding não é congelamento)', async () => {
      // Regressão do smoke 044 F4b: o onboarding gravava dose-only com o carimbo, o usuário
      // nascia parecendo "congelado" e o toggle de Settings RETOMAVA em silêncio (gap de
      // minutos) em vez de pedir o saldo inicial — a tela do PO-3 nunca aparecia.
      const client = makeClient({ data: { stock_tracking_enabled: false, stock_paused_at: null }, error: null })
      const repo = createProfileRepository({ client, getUserId })

      await repo.setStockTracking(false, { freeze: false })

      const [payload] = client._builder.upsert.mock.calls[0]
      expect(payload.stock_tracking_enabled).toBe(false)
      expect(payload.stock_paused_at).toBeNull()
    })

    it('off sem options → carimba (default preserva o opt-out da F4a)', async () => {
      const client = makeClient({ data: { stock_tracking_enabled: false, stock_paused_at: '2026-07-11T12:00:00Z' }, error: null })
      await createProfileRepository({ client, getUserId }).setStockTracking(false)

      const [payload] = client._builder.upsert.mock.calls[0]
      expect(payload.stock_paused_at).toEqual(expect.any(String))
    })

    it('on → limpa stock_paused_at', async () => {
      const client = makeClient({ data: { stock_tracking_enabled: true, stock_paused_at: null }, error: null })
      await createProfileRepository({ client, getUserId }).setStockTracking(true)

      const [payload] = client._builder.upsert.mock.calls[0]
      expect(payload.stock_tracking_enabled).toBe(true)
      expect(payload.stock_paused_at).toBeNull()
    })

    it('rejeita valor não-booleano', async () => {
      const client = makeClient({ data: null, error: null })
      await expect(createProfileRepository({ client, getUserId }).setStockTracking('sim' as any)).rejects.toThrow(/boolean/)
    })
  })
})
