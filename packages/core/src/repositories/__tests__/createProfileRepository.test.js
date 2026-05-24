// Parity tests — createProfileRepository (Fase 4 G2)
//
// Garante que web e mobile, ao injetarem client + getUserId, produzem:
//   - As mesmas chamadas Supabase (table, select, upsert payload, onConflict, rpc)
//   - O mesmo formato de erro de validação Zod
//   - Default object em getProfile quando ainda não há linha
//
// Mock builder fluente (espelha createStockRepository.test.js) + upsert/maybeSingle/rpc.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createProfileRepository } from '../createProfileRepository.js'

// ---------- Mock Supabase fluent builder ----------
function makeBuilder(result) {
  const builder = {
    _calls: [],
    select:      vi.fn(function (...a) { this._calls.push(['select', a]); return this }),
    upsert:      vi.fn(function (...a) { this._calls.push(['upsert', a]); return this }),
    eq:          vi.fn(function (...a) { this._calls.push(['eq', a]); return this }),
    single:      vi.fn(function ()     { this._calls.push(['single', []]); return Promise.resolve(result) }),
    maybeSingle: vi.fn(function ()     { this._calls.push(['maybeSingle', []]); return Promise.resolve(result) }),
    then: (resolve) => resolve(result),
  }
  return builder
}

function makeClient(result, rpcResult) {
  const builder = makeBuilder(result)
  const client = {
    _builder: builder,
    _from: null,
    _rpcCalls: [],
    from: vi.fn((table) => { client._from = table; return builder }),
    rpc: vi.fn((name, args) => {
      client._rpcCalls.push([name, args])
      return Promise.resolve(rpcResult ?? { data: { ok: true }, error: null })
    }),
  }
  return client
}

const FAKE_USER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const getUserId = async () => FAKE_USER

const VALID_PROFILE = {
  display_name: 'Antonio Coelho',
  birth_date: '1976-11-18',
  city: 'São Paulo',
  state: 'SP',
  phone: '(11) 98213-0685',
}

describe('createProfileRepository — parity', () => {
  let client

  beforeEach(() => {
    client = makeClient({ data: null, error: null })
  })

  // ── Constructor validation ──
  it('throws se client ausente', () => {
    expect(() => createProfileRepository({ getUserId })).toThrow(/client/)
  })
  it('throws se getUserId não for função', () => {
    expect(() => createProfileRepository({ client, getUserId: null })).toThrow(/getUserId/)
  })

  // ── getProfile ──
  describe('getProfile', () => {
    it('consulta user_settings por user_id via maybeSingle', async () => {
      client = makeClient({ data: { display_name: 'Antonio', phone: null }, error: null })
      const repo = createProfileRepository({ client, getUserId })
      const out = await repo.getProfile()

      expect(client.from).toHaveBeenCalledWith('user_settings')
      const calls = client._builder._calls.map((c) => c[0])
      expect(calls).toContain('select')
      expect(calls).toContain('maybeSingle')
      expect(client._builder._calls.find((c) => c[0] === 'eq')[1]).toEqual(['user_id', FAKE_USER])
      expect(out.display_name).toBe('Antonio')
    })

    it('retorna default object (campos null) quando não há linha', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createProfileRepository({ client, getUserId })
      const out = await repo.getProfile()
      expect(out).toEqual({
        display_name: null, birth_date: null, city: null,
        state: null, phone: null, complexity_override: null,
      })
    })

    it('propaga erro do Supabase', async () => {
      client = makeClient({ data: null, error: new Error('db down') })
      const repo = createProfileRepository({ client, getUserId })
      await expect(repo.getProfile()).rejects.toThrow('db down')
    })
  })

  // ── updateProfile ──
  describe('updateProfile', () => {
    it('upsert com user_id + updated_at + onConflict user_id', async () => {
      client = makeClient({ data: { ...VALID_PROFILE }, error: null })
      const repo = createProfileRepository({ client, getUserId })
      await repo.updateProfile(VALID_PROFILE)

      const upsert = client._builder._calls.find((c) => c[0] === 'upsert')
      expect(upsert).toBeTruthy()
      const [payload, opts] = upsert[1]
      expect(payload.user_id).toBe(FAKE_USER)
      expect(payload.display_name).toBe('Antonio Coelho')
      expect(payload.phone).toBe('(11) 98213-0685')
      expect(payload.updated_at).toBeTruthy()
      expect(opts).toEqual({ onConflict: 'user_id' })
    })

    it('rejeita com formato de erro de validação quando display_name ausente', async () => {
      const repo = createProfileRepository({ client, getUserId })
      await expect(repo.updateProfile({ city: 'SP' })).rejects.toThrow(/Erro de validação/)
    })

    it('aceita phone null (nullable/optional)', async () => {
      client = makeClient({ data: {}, error: null })
      const repo = createProfileRepository({ client, getUserId })
      await expect(
        repo.updateProfile({ display_name: 'Ana', phone: null }),
      ).resolves.toBeDefined()
    })
  })

  // ── updateComplexity (densidade da interface) ──
  describe('updateComplexity', () => {
    it.each(['simple', 'complex', null])('aceita valor %s e faz upsert', async (value) => {
      client = makeClient({ data: { complexity_override: value }, error: null })
      const repo = createProfileRepository({ client, getUserId })
      await repo.updateComplexity(value)

      const upsert = client._builder._calls.find((c) => c[0] === 'upsert')
      expect(upsert[1][0]).toMatchObject({ user_id: FAKE_USER, complexity_override: value })
      expect(upsert[1][1]).toEqual({ onConflict: 'user_id' })
    })

    it('rejeita valor inválido', async () => {
      const repo = createProfileRepository({ client, getUserId })
      await expect(repo.updateComplexity('detalhado')).rejects.toThrow(/complexity_override/)
    })
  })

  // ── deleteAccount ──
  describe('deleteAccount', () => {
    it('chama RPC delete_user_account', async () => {
      const repo = createProfileRepository({ client, getUserId })
      await repo.deleteAccount()
      expect(client._rpcCalls).toContainEqual(['delete_user_account', undefined])
    })

    it('propaga erro do RPC', async () => {
      client = makeClient({ data: null, error: null }, { data: null, error: new Error('tratamentos ativos') })
      const repo = createProfileRepository({ client, getUserId })
      await expect(repo.deleteAccount()).rejects.toThrow('tratamentos ativos')
    })
  })
})
