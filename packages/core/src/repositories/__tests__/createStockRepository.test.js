// Parity tests — createStockRepository (Fase 3 S3.2 G2)
//
// Garante que web e mobile, ao injetarem client + getUserId, produzem:
//   - As mesmas chamadas Supabase (table, filter, RPC name + args, payload)
//   - O mesmo formato de erro de validação
//   - Transforms client-side aplicados (PO-9 filter, adjustToBalance delta)
//
// Mock builder fluente (espelha createProtocolRepository.test.js) + suporte a .rpc/.maybeSingle.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStockRepository } from '../createStockRepository.js'

// ---------- Mock Supabase fluent builder ----------
function makeBuilder(result) {
  const builder = {
    _calls: [],
    select:      vi.fn(function (...a) { this._calls.push(['select', a]); return this }),
    insert:      vi.fn(function (...a) { this._calls.push(['insert', a]); return this }),
    update:      vi.fn(function (...a) { this._calls.push(['update', a]); return this }),
    delete:      vi.fn(function (...a) { this._calls.push(['delete', a]); return this }),
    eq:          vi.fn(function (...a) { this._calls.push(['eq', a]); return this }),
    lte:         vi.fn(function (...a) { this._calls.push(['lte', a]); return this }),
    in:          vi.fn(function (...a) { this._calls.push(['in', a]); return this }),
    order:       vi.fn(function (...a) { this._calls.push(['order', a]); return this }),
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
    _rpcCalls: [],
    from: vi.fn(() => builder),
    rpc: vi.fn((name, args) => {
      client._rpcCalls.push([name, args])
      return Promise.resolve(rpcResult ?? { data: { ok: true }, error: null })
    }),
  }
  return client
}

const FAKE_USER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const getUserId = async () => FAKE_USER

describe('createStockRepository — parity', () => {
  let client

  beforeEach(() => {
    client = makeClient({ data: [], error: null })
  })

  // ── Constructor validation ──
  it('throws se client ausente', () => {
    expect(() => createStockRepository({ getUserId })).toThrow(/client/)
  })
  it('throws se getUserId não for função', () => {
    expect(() => createStockRepository({ client, getUserId: null })).toThrow(/getUserId/)
  })

  // ── getMedicinesWithStockOrActiveProtocol (PO-9 filter) ──
  describe('getMedicinesWithStockOrActiveProtocol', () => {
    it('filtra client-side: inclui se hasActiveProtocol OU totalStock > 0', async () => {
      const rows = [
        { id: 'm-keep-stock', protocols: [], medicine_stock_summary: [{ total_quantity: 5 }] },
        { id: 'm-drop', protocols: [], medicine_stock_summary: [{ total_quantity: 0 }] },
        {
          id: 'm-keep-proto',
          protocols: [{ active: true, frequency: 'diario', start_date: '2020-01-01', end_date: null }],
          medicine_stock_summary: [{ total_quantity: 0 }],
        },
      ]
      client = makeClient({ data: rows, error: null })
      const repo = createStockRepository({ client, getUserId })
      const result = await repo.getMedicinesWithStockOrActiveProtocol()
      expect(client.from).toHaveBeenCalledWith('medicines')
      const calls = client._builder._calls
      expect(calls).toContainEqual(['eq', ['user_id', FAKE_USER]])
      // NÃO filtra protocols.active no servidor (apenas user_id + order)
      expect(calls.find(([m, a]) => m === 'eq' && a[0] === 'protocols.active')).toBeUndefined()
      const ids = result.map((m) => m.id)
      expect(ids).toContain('m-keep-stock')
      expect(ids).toContain('m-keep-proto')
      expect(ids).not.toContain('m-drop')
    })

    it('valida userId como uuid', async () => {
      const badClient = makeClient({ data: [], error: null })
      const repo = createStockRepository({ client: badClient, getUserId: async () => 'not-a-uuid' })
      await expect(repo.getMedicinesWithStockOrActiveProtocol()).rejects.toThrow()
    })
  })

  // ── getByMedicine ──
  describe('getByMedicine', () => {
    it('select stock + eq medicine_id/user_id + order created_at desc', async () => {
      const repo = createStockRepository({ client, getUserId })
      await repo.getByMedicine('med-1')
      expect(client.from).toHaveBeenCalledWith('stock')
      const calls = client._builder._calls
      expect(calls).toContainEqual(['eq', ['medicine_id', 'med-1']])
      expect(calls).toContainEqual(['eq', ['user_id', FAKE_USER]])
      expect(calls).toContainEqual(['order', ['created_at', { ascending: false }]])
    })
  })

  // ── getStockSummary ──
  describe('getStockSummary', () => {
    it('maybeSingle + default object se data null', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createStockRepository({ client, getUserId })
      const result = await repo.getStockSummary('med-1')
      expect(client.from).toHaveBeenCalledWith('medicine_stock_summary')
      expect(client._builder._calls).toContainEqual(['maybeSingle', []])
      expect(result).toMatchObject({ medicine_id: 'med-1', total_quantity: 0 })
    })
    it('retorna data se presente', async () => {
      client = makeClient({ data: { medicine_id: 'med-1', total_quantity: 42 }, error: null })
      const repo = createStockRepository({ client, getUserId })
      expect(await repo.getStockSummary('med-1')).toMatchObject({ total_quantity: 42 })
    })
  })

  // ── getStockSummaryMap ──
  describe('getStockSummaryMap', () => {
    it('reduz rows em mapa medicineId → total_quantity', async () => {
      client = makeClient({ data: [{ medicine_id: 'a', total_quantity: 3 }, { medicine_id: 'b', total_quantity: null }], error: null })
      const repo = createStockRepository({ client, getUserId })
      expect(await repo.getStockSummaryMap()).toEqual({ a: 3, b: 0 })
    })
  })

  // ── getTotalQuantity ──
  describe('getTotalQuantity', () => {
    it('usa view quando presente', async () => {
      client = makeClient({ data: { total_quantity: 99 }, error: null })
      const repo = createStockRepository({ client, getUserId })
      expect(await repo.getTotalQuantity('med-1')).toBe(99)
    })
    it('fallback soma manual quando view vazia', async () => {
      // maybeSingle retorna null → cai no fallback (then resolve mesma data... ajustamos)
      const builder = makeBuilder(null)
      let mode = 'summary'
      builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
      builder.then = (resolve) => resolve({ data: [{ quantity: 2 }, { quantity: 3 }], error: null })
      void mode
      const fbClient = { _builder: builder, from: vi.fn(() => builder), rpc: vi.fn() }
      const repo = createStockRepository({ client: fbClient, getUserId })
      expect(await repo.getTotalQuantity('med-1')).toBe(5)
    })
  })

  // ── getLowStockMedicines ──
  describe('getLowStockMedicines', () => {
    it('chama RPC get_low_stock_medicines com threshold', async () => {
      client = makeClient({ data: [], error: null }, { data: [{ id: 'm' }], error: null })
      const repo = createStockRepository({ client, getUserId })
      const result = await repo.getLowStockMedicines(5)
      expect(client._rpcCalls).toContainEqual(['get_low_stock_medicines', { p_user_id: FAKE_USER, p_threshold: 5 }])
      expect(result).toEqual([{ id: 'm' }])
    })
    it('fallback view se RPC erra', async () => {
      client = makeClient({ data: [{ id: 'fb' }], error: null }, { data: null, error: new Error('rpc fail') })
      const repo = createStockRepository({ client, getUserId })
      const result = await repo.getLowStockMedicines()
      expect(client.from).toHaveBeenCalledWith('medicine_stock_summary')
      expect(result).toEqual([{ id: 'fb' }])
    })
  })

  // ── decreaseStock ──
  describe('decreaseStock', () => {
    it('throws se medicineLogId ausente', async () => {
      const repo = createStockRepository({ client, getUserId })
      await expect(repo.decreaseStock('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 2, null)).rejects.toThrow(/medicineLogId/)
    })
    it('validation fail → Erro de validação', async () => {
      const repo = createStockRepository({ client, getUserId })
      await expect(repo.decreaseStock('not-uuid', 2, 'log-1')).rejects.toThrow(/Erro de validação/)
    })
    it('chama RPC consume_stock_fifo', async () => {
      const repo = createStockRepository({ client, getUserId })
      await repo.decreaseStock('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 2, 'log-1')
      expect(client._rpcCalls).toContainEqual([
        'consume_stock_fifo',
        { p_medicine_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', p_quantity: 2, p_medicine_log_id: 'log-1' },
      ])
    })
  })

  // ── increaseStock ──
  describe('increaseStock', () => {
    const MED = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    it('com medicine_log_id → restore_stock_for_log', async () => {
      const repo = createStockRepository({ client, getUserId })
      const LOG_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
      await repo.increaseStock(MED, 2, { medicine_log_id: LOG_ID, reason: 'estorno' })
      const call = client._rpcCalls.find(([n]) => n === 'restore_stock_for_log')
      expect(call[1]).toMatchObject({ p_medicine_log_id: LOG_ID, p_reason: 'estorno' })
    })
    it('sem medicine_log_id → apply_manual_stock_adjustment delta positivo', async () => {
      const repo = createStockRepository({ client, getUserId })
      await repo.increaseStock(MED, 4, { reason: 'ajuste', notes: 'x' })
      const call = client._rpcCalls.find(([n]) => n === 'apply_manual_stock_adjustment')
      expect(call[1]).toMatchObject({ p_medicine_id: MED, p_quantity_delta: 4, p_reason: 'ajuste' })
    })
  })

  // ── adjustToBalance (PO-6 delta branches) ──
  describe('adjustToBalance', () => {
    const MED = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    function clientWithTotal(total) {
      const builder = makeBuilder(null)
      builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { total_quantity: total }, error: null }))
      const c = { _builder: builder, _rpcCalls: [], from: vi.fn(() => builder),
        rpc: vi.fn((name, args) => { c._rpcCalls.push([name, args]); return Promise.resolve({ data: {}, error: null }) }) }
      return c
    }
    it('throws se reason ausente', async () => {
      const repo = createStockRepository({ client, getUserId })
      await expect(repo.adjustToBalance(MED, 10, null)).rejects.toThrow(/Motivo/)
    })
    it('throws se newBalance negativo', async () => {
      const repo = createStockRepository({ client, getUserId })
      await expect(repo.adjustToBalance(MED, -1, 'r')).rejects.toThrow(/negativo/)
    })
    it('delta=0 → no-op, retorna {delta:0}', async () => {
      const c = clientWithTotal(10)
      const repo = createStockRepository({ client: c, getUserId })
      const res = await repo.adjustToBalance(MED, 10, 'r')
      expect(res).toEqual({ delta: 0, before: 10, after: 10 })
      expect(c._rpcCalls).toHaveLength(0)
    })
    it('delta>0 → increaseStock (apply_manual_stock_adjustment positivo)', async () => {
      const c = clientWithTotal(5)
      const repo = createStockRepository({ client: c, getUserId })
      const res = await repo.adjustToBalance(MED, 12, 'compra extra')
      expect(res).toEqual({ delta: 7, before: 5, after: 12 })
      const call = c._rpcCalls.find(([n]) => n === 'apply_manual_stock_adjustment')
      expect(call[1]).toMatchObject({ p_quantity_delta: 7 })
    })
    it('delta<0 → apply_manual_stock_adjustment com delta negativo', async () => {
      const c = clientWithTotal(20)
      const repo = createStockRepository({ client: c, getUserId })
      const res = await repo.adjustToBalance(MED, 8, 'perda')
      expect(res).toEqual({ delta: -12, before: 20, after: 8 })
      const call = c._rpcCalls.find(([n]) => n === 'apply_manual_stock_adjustment')
      expect(call[1]).toMatchObject({ p_quantity_delta: -12, p_reason: 'perda' })
    })
    it('sobrevive a destructuring (usa repo.* não this.*)', async () => {
      const c = clientWithTotal(5)
      const repo = createStockRepository({ client: c, getUserId })
      const { adjustToBalance } = repo
      const res = await adjustToBalance(MED, 9, 'r')
      expect(res.delta).toBe(4)
    })
  })

  // ── delete ──
  describe('delete', () => {
    it('apaga entry sem consumo associado', async () => {
      client = makeClient({ data: { entry_type: 'purchase', original_quantity: 10, quantity: 10 }, error: null })
      const repo = createStockRepository({ client, getUserId })
      await repo.delete('s-1')
      expect(client._builder._calls).toContainEqual(['delete', []])
    })
    it('bloqueia delete de compra com consumo associado', async () => {
      client = makeClient({ data: { entry_type: 'purchase', original_quantity: 10, quantity: 4 }, error: null })
      const repo = createStockRepository({ client, getUserId })
      await expect(repo.delete('s-1')).rejects.toThrow(/consumo associado/)
    })
  })
})
