// Parity tests — createPurchaseRepository (Fase 3 S3.2 G2)
//
// Garante: chamadas Supabase (table, filter, embed, RPC name + args), formato de
// erro de validação, e transforms client-side (remaining computado, mapas, média).
//
// Mock builder fluente (espelha createProtocolRepository.test.js) + suporte a .rpc.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPurchaseRepository } from '../createPurchaseRepository.js'

function makeBuilder(result) {
  const builder = {
    _calls: [],
    select: vi.fn(function (...a) { this._calls.push(['select', a]); return this }),
    update: vi.fn(function (...a) { this._calls.push(['update', a]); return this }),
    eq:     vi.fn(function (...a) { this._calls.push(['eq', a]); return this }),
    in:     vi.fn(function (...a) { this._calls.push(['in', a]); return this }),
    order:  vi.fn(function (...a) { this._calls.push(['order', a]); return this }),
    single: vi.fn(function ()     { this._calls.push(['single', []]); return Promise.resolve(result) }),
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
      return Promise.resolve(rpcResult ?? { data: { id: 'new' }, error: null })
    }),
  }
  return client
}

const FAKE_USER = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const getUserId = async () => FAKE_USER

// purchase_date no passado pra passar validateStockCreate
const VALID_INPUT = {
  medicine_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  quantity: 30,
  purchase_date: '2026-01-10',
  unit_price: 12.5,
}

describe('createPurchaseRepository — parity', () => {
  let client

  beforeEach(() => {
    client = makeClient({ data: [], error: null })
  })

  // ── Constructor validation ──
  it('throws se client ausente', () => {
    expect(() => createPurchaseRepository({ getUserId })).toThrow(/client/)
  })
  it('throws se getUserId não for função', () => {
    expect(() => createPurchaseRepository({ client, getUserId: null })).toThrow(/getUserId/)
  })

  // ── getPurchasesByMedicine (embed + remaining) ──
  describe('getPurchasesByMedicine', () => {
    it('embed stock(quantity) e computa remaining = soma quantities', async () => {
      client = makeClient({
        data: [
          { id: 'p1', stock: [{ quantity: 2 }, { quantity: 3 }] },
          { id: 'p2', stock: [] },
          { id: 'p3' },
        ],
        error: null,
      })
      const repo = createPurchaseRepository({ client, getUserId })
      const result = await repo.getPurchasesByMedicine('med-1')
      expect(client.from).toHaveBeenCalledWith('purchases')
      const calls = client._builder._calls
      expect(calls).toContainEqual(['select', ['*, stock(quantity)']])
      expect(calls).toContainEqual(['eq', ['medicine_id', 'med-1']])
      expect(calls).toContainEqual(['eq', ['user_id', FAKE_USER]])
      expect(result.find((p) => p.id === 'p1').remaining).toBe(5)
      expect(result.find((p) => p.id === 'p2').remaining).toBe(0)
      expect(result.find((p) => p.id === 'p3').remaining).toBe(0)
    })
  })

  // ── getLatestPurchasesByMedicineIds ──
  describe('getLatestPurchasesByMedicineIds', () => {
    it('retorna {} se lista vazia (sem query)', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      expect(await repo.getLatestPurchasesByMedicineIds([])).toEqual({})
      expect(client.from).not.toHaveBeenCalled()
    })
    it('mapeia medicineId → primeira (mais recente) compra', async () => {
      client = makeClient({
        data: [
          { id: 'p1', medicine_id: 'm-a' },
          { id: 'p2', medicine_id: 'm-a' },
          { id: 'p3', medicine_id: 'm-b' },
        ],
        error: null,
      })
      const repo = createPurchaseRepository({ client, getUserId })
      const map = await repo.getLatestPurchasesByMedicineIds(['m-a', 'm-b'])
      expect(client._builder._calls).toContainEqual(['in', ['medicine_id', ['m-a', 'm-b']]])
      expect(map['m-a'].id).toBe('p1')
      expect(map['m-b'].id).toBe('p3')
    })
  })

  // ── getHistoryByMedicineIds ──
  describe('getHistoryByMedicineIds', () => {
    it('mapeia medicineId → array de compras', async () => {
      client = makeClient({
        data: [
          { id: 'p1', medicine_id: 'm-a' },
          { id: 'p2', medicine_id: 'm-a' },
          { id: 'p3', medicine_id: 'm-b' },
        ],
        error: null,
      })
      const repo = createPurchaseRepository({ client, getUserId })
      const map = await repo.getHistoryByMedicineIds(['m-a', 'm-b'])
      expect(map['m-a']).toHaveLength(2)
      expect(map['m-b']).toHaveLength(1)
    })
  })

  // ── getAverageUnitPriceByMedicineIds ──
  describe('getAverageUnitPriceByMedicineIds', () => {
    it('média ponderada via computeAverageUnitPrice (quantity_bought)', async () => {
      client = makeClient({
        data: [
          { medicine_id: 'm-a', quantity_bought: 10, unit_price: 2 },
          { medicine_id: 'm-a', quantity_bought: 30, unit_price: 6 },
        ],
        error: null,
      })
      const repo = createPurchaseRepository({ client, getUserId })
      const map = await repo.getAverageUnitPriceByMedicineIds(['m-a'])
      // (10*2 + 30*6) / 40 = 200/40 = 5
      expect(map['m-a']).toBeCloseTo(5)
    })
    it('retorna {} se lista vazia', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      expect(await repo.getAverageUnitPriceByMedicineIds([])).toEqual({})
    })
  })

  // ── createPurchase ──
  describe('createPurchase', () => {
    it('validation fail → Erro de validação', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await expect(repo.createPurchase({ quantity: 1 })).rejects.toThrow(/Erro de validação/)
    })
    it('validation ok → RPC create_purchase_with_stock com param mapping', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.createPurchase(VALID_INPUT)
      const call = client._rpcCalls.find(([n]) => n === 'create_purchase_with_stock')
      expect(call[1]).toMatchObject({
        p_medicine_id: VALID_INPUT.medicine_id,
        p_quantity: 30,
        p_unit_price: 12.5,
        p_purchase_date: '2026-01-10',
      })
    })
  })

  // ── updatePurchase ──
  describe('updatePurchase', () => {
    beforeEach(() => {
      client = makeClient({ data: { id: 'p-1' }, error: null })
    })
    it('atualiza metadados SEM quantity_bought', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.updatePurchase('p-1', VALID_INPUT)
      const calls = client._builder._calls
      const updateCall = calls.find(([m]) => m === 'update')
      const payload = updateCall[1][0]
      expect(payload).toHaveProperty('unit_price', 12.5)
      expect(payload).toHaveProperty('purchase_date', '2026-01-10')
      expect(payload).not.toHaveProperty('quantity_bought')
      expect(payload).not.toHaveProperty('quantity')
      expect(calls).toContainEqual(['eq', ['id', 'p-1']])
      expect(calls).toContainEqual(['eq', ['user_id', FAKE_USER]])
    })
    it('validation fail → Erro de validação', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await expect(repo.updatePurchase('p-1', { quantity: -5 })).rejects.toThrow(/Erro de validação/)
    })
  })
})
