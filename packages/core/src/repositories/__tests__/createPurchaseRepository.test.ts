// Parity tests — createPurchaseRepository (Fase 3 S3.2 G2)
//
// Garante: chamadas Supabase (table, filter, embed, RPC name + args), formato de
// erro de validação, e transforms client-side (remaining computado, mapas, média).
//
// Mock builder fluente (espelha createProtocolRepository.test.js) + suporte a .rpc.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPurchaseRepository } from '../createPurchaseRepository'

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

function makeClient(result, rpcResult?) {
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
  return client as any
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
    expect(() => createPurchaseRepository({ getUserId } as any)).toThrow(/client/)
  })
  it('throws se getUserId não for função', () => {
    expect(() => createPurchaseRepository({ client, getUserId: null } as any)).toThrow(/getUserId/)
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
    // 012 B4 (ADR-068): container por lote vai como p_injection_container na RPC.
    it('passa p_injection_container quando informado', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.createPurchase({ ...VALID_INPUT, injection_container: 'caneta' })
      const call = client._rpcCalls.find(([n]) => n === 'create_purchase_with_stock')
      expect(call[1].p_injection_container).toBe('caneta')
    })
    it('p_injection_container = null quando ausente', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.createPurchase(VALID_INPUT)
      const call = client._rpcCalls.find(([n]) => n === 'create_purchase_with_stock')
      expect(call[1].p_injection_container).toBeNull()
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
    // 012 B4 (ADR-068): edit propaga container ao purchases E ao lote stock vinculado.
    it('grava injection_container em purchases e propaga ao stock', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.updatePurchase('p-1', { ...VALID_INPUT, injection_container: 'refil' })
      const updateCalls = client._builder._calls.filter(([m]) => m === 'update')
      // 1ª update = purchases (com container), 2ª = stock (só container).
      expect(updateCalls[0][1][0]).toHaveProperty('injection_container', 'refil')
      expect(client.from).toHaveBeenCalledWith('stock')
      expect(updateCalls[1][1][0]).toEqual({ injection_container: 'refil' })
    })
  })

  // ── createLiquidPurchase (desmembramento — 022 Fase B) ──
  describe('createLiquidPurchase', () => {
    const LIQ = {
      medicineId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      volumePerBottle: 100,
      purchaseDate: '2026-01-10',
    }

    it('3 frascos / R$30 → 3 RPCs, p_quantity=100, unit_price=0.03 (0.30/frasco ÷ 100ml)', async () => {
      client = makeClient({ data: [], error: null }, { data: { id: 'x' }, error: null })
      const repo = createPurchaseRepository({ client, getUserId })
      const res = await repo.createLiquidPurchase({ ...LIQ, numBottles: 3, totalPrice: 30 })
      expect(res).toHaveLength(3)
      const rpcs = client._rpcCalls.filter(([n]) => n === 'create_purchase_with_stock')
      expect(rpcs).toHaveLength(3)
      rpcs.forEach(([, args]) => {
        expect(args.p_quantity).toBe(100)
        expect(args.p_unit_price).toBeCloseTo(0.1, 4) // R$10/frasco ÷ 100ml = 0.10/ml
      })
    })

    it('compensa centavos no último frasco (R$10 / 3 frascos)', async () => {
      client = makeClient({ data: [], error: null }, { data: { id: 'x' }, error: null })
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.createLiquidPurchase({ ...LIQ, numBottles: 3, totalPrice: 10 })
      const rpcs = client._rpcCalls.filter(([n]) => n === 'create_purchase_with_stock')
      // pricePerBottle=3.33 → unit_price 0.0333; último: 10-3.33*2=3.34 → 0.0334.
      const prices = rpcs.map(([, a]) => a.p_unit_price)
      expect(prices[0]).toBeCloseTo(0.0333, 4)
      expect(prices[2]).toBeCloseTo(0.0334, 4)
      // total reconstruído ≈ R$10 (sem perda de centavos)
      const total = prices.reduce((s, p) => s + p * 100, 0)
      expect(total).toBeCloseTo(10, 2)
    })

    it('1 frasco → 1 RPC sem compensação', async () => {
      client = makeClient({ data: [], error: null }, { data: { id: 'x' }, error: null })
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.createLiquidPurchase({ ...LIQ, numBottles: 1, totalPrice: 50 })
      const rpcs = client._rpcCalls.filter(([n]) => n === 'create_purchase_with_stock')
      expect(rpcs).toHaveLength(1)
      expect(rpcs[0][1].p_unit_price).toBeCloseTo(0.5, 4)
    })

    it('numBottles ≤ 0 ou não-inteiro → rejeita (sem loop/div0)', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await expect(repo.createLiquidPurchase({ ...LIQ, numBottles: 0, totalPrice: 10 })).rejects.toThrow(/frascos/)
      await expect(repo.createLiquidPurchase({ ...LIQ, numBottles: 2.5, totalPrice: 10 })).rejects.toThrow(/frascos/)
    })

    it('volumePerBottle ≤ 0 → rejeita (evita div por zero no custo/ml)', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await expect(
        repo.createLiquidPurchase({ ...LIQ, volumePerBottle: 0, numBottles: 2, totalPrice: 10 })
      ).rejects.toThrow(/Volume/)
    })

    it('totalPrice negativo → rejeita', async () => {
      const repo = createPurchaseRepository({ client, getUserId })
      await expect(
        repo.createLiquidPurchase({ ...LIQ, numBottles: 2, totalPrice: -5 })
      ).rejects.toThrow(/negativo/)
    })

    it('centavos baixos (R$0,04 / 6 frascos) → nenhum unit_price negativo (review #651)', async () => {
      client = makeClient({ data: [], error: null }, { data: { id: 'x' }, error: null })
      const repo = createPurchaseRepository({ client, getUserId })
      await repo.createLiquidPurchase({ ...LIQ, numBottles: 6, totalPrice: 0.04 })
      const rpcs = client._rpcCalls.filter(([n]) => n === 'create_purchase_with_stock')
      expect(rpcs).toHaveLength(6)
      rpcs.forEach(([, a]) => expect(a.p_unit_price).toBeGreaterThanOrEqual(0))
    })
  })
})
