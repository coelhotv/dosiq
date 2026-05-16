// Parity tests — createMedicineRepository (Fase 1 G2)
//
// Garante que web e mobile, ao injetarem suas opções/transforms, produzem:
//   - As mesmas chamadas Supabase (table, filter, payload)
//   - O mesmo formato de erro de validação
//   - Transforms são aplicados em getAll/getById
//
// Não tocamos no Supabase real — mock builder fluente.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMedicineRepository } from '../createMedicineRepository.js'

// ---------- Mock Supabase fluent builder ----------
function makeBuilder(result) {
  const builder = {
    _calls: [],
    select: vi.fn(function (...args) { this._calls.push(['select', args]); return this }),
    insert: vi.fn(function (...args) { this._calls.push(['insert', args]); return this }),
    update: vi.fn(function (...args) { this._calls.push(['update', args]); return this }),
    delete: vi.fn(function (...args) { this._calls.push(['delete', args]); return this }),
    eq:     vi.fn(function (...args) { this._calls.push(['eq', args]); return this }),
    order:  vi.fn(function (...args) { this._calls.push(['order', args]); return this }),
    single: vi.fn(function ()        { this._calls.push(['single', []]); return Promise.resolve(result) }),
    then:   (resolve) => resolve(result), // permite await em chain sem .single()
  }
  return builder
}

function makeClient(result) {
  const builder = makeBuilder(result)
  const client = {
    _builder: builder,
    _from: null,
    from: vi.fn((table) => { client._from = table; return builder }),
  }
  return client
}

const FAKE_USER = 'user-uuid-123'
const getUserId = async () => FAKE_USER

const VALID_MEDICINE = {
  name: 'Paracetamol',
  dosage_per_pill: 500,
  dosage_unit: 'mg',
}

// ---------- Suite ----------
describe('createMedicineRepository — parity', () => {
  let client

  beforeEach(() => {
    client = makeClient({ data: [{ id: 'med-1', name: 'X' }], error: null })
  })

  it('throws if client missing', () => {
    expect(() => createMedicineRepository({ getUserId })).toThrow(/client/)
  })

  it('throws if getUserId not function', () => {
    expect(() => createMedicineRepository({ client, getUserId: null })).toThrow(/getUserId/)
  })

  describe('getAll', () => {
    it('selects from medicines + filters by user_id + orders desc by created_at', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await repo.getAll()
      expect(client.from).toHaveBeenCalledWith('medicines')
      const calls = client._builder._calls
      expect(calls).toEqual([
        ['select', ['*']],
        ['eq', ['user_id', FAKE_USER]],
        ['order', ['created_at', { ascending: false }]],
      ])
    })

    it('honors listSelect override (web preset)', async () => {
      const repo = createMedicineRepository({
        client, getUserId,
        listSelect: '*, stock(*), purchases(*)',
      })
      await repo.getAll()
      expect(client._builder.select).toHaveBeenCalledWith('*, stock(*), purchases(*)')
    })

    it('honors listSelect override (mobile preset)', async () => {
      const repo = createMedicineRepository({
        client, getUserId,
        listSelect: '*, protocols(id)',
      })
      await repo.getAll()
      expect(client._builder.select).toHaveBeenCalledWith('*, protocols(id)')
    })

    it('applies listTransform', async () => {
      client = makeClient({ data: [{ id: 'a' }, { id: 'b' }], error: null })
      const repo = createMedicineRepository({
        client, getUserId,
        listTransform: (rows) => rows.map((r) => ({ ...r, tagged: true })),
      })
      const result = await repo.getAll()
      expect(result).toEqual([{ id: 'a', tagged: true }, { id: 'b', tagged: true }])
    })

    it('returns [] when data null', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createMedicineRepository({ client, getUserId })
      const result = await repo.getAll()
      expect(result).toEqual([])
    })

    it('throws on supabase error', async () => {
      client = makeClient({ data: null, error: new Error('boom') })
      const repo = createMedicineRepository({ client, getUserId })
      await expect(repo.getAll()).rejects.toThrow('boom')
    })
  })

  describe('getById', () => {
    beforeEach(() => {
      client = makeClient({ data: { id: 'med-1', name: 'X' }, error: null })
    })

    it('selects detail + filters id + user_id + .single()', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await repo.getById('med-1')
      const calls = client._builder._calls
      expect(calls).toEqual([
        ['select', ['*']],
        ['eq', ['id', 'med-1']],
        ['eq', ['user_id', FAKE_USER]],
        ['single', []],
      ])
    })

    it('applies detailTransform', async () => {
      const repo = createMedicineRepository({
        client, getUserId,
        detailTransform: (row) => ({ ...row, decorated: 1 }),
      })
      const result = await repo.getById('med-1')
      expect(result).toEqual({ id: 'med-1', name: 'X', decorated: 1 })
    })
  })

  describe('create', () => {
    beforeEach(() => {
      client = makeClient({ data: { id: 'new-1', ...VALID_MEDICINE }, error: null })
    })

    it('valida + insere payload com user_id', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await repo.create(VALID_MEDICINE)
      const insertCall = client._builder._calls.find(([m]) => m === 'insert')
      expect(insertCall[1][0]).toEqual([
        expect.objectContaining({
          name: 'Paracetamol',
          dosage_per_pill: 500,
          dosage_unit: 'mg',
          user_id: FAKE_USER,
        }),
      ])
    })

    it('rejeita payload inválido com mensagem PT-BR', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await expect(repo.create({ dosage_per_pill: 100, dosage_unit: 'mg' }))
        .rejects.toThrow(/Erro de validação/)
    })

    it('aceita string em dosage_per_pill (z.coerce.number)', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await repo.create({ ...VALID_MEDICINE, dosage_per_pill: '500' })
      const insertCall = client._builder._calls.find(([m]) => m === 'insert')
      expect(insertCall[1][0][0].dosage_per_pill).toBe(500)
    })
  })

  describe('update', () => {
    beforeEach(() => {
      client = makeClient({ data: { id: 'med-1', name: 'Novo' }, error: null })
    })

    it('valida partial + update por id + user_id', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await repo.update('med-1', { name: 'Novo' })
      const calls = client._builder._calls
      expect(calls[0]).toEqual(['update', [expect.objectContaining({ name: 'Novo' })]])
      expect(calls[1]).toEqual(['eq', ['id', 'med-1']])
      expect(calls[2]).toEqual(['eq', ['user_id', FAKE_USER]])
    })

    it('rejeita update com campo inválido', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await expect(repo.update('med-1', { name: 'x' }))
        .rejects.toThrow(/Erro de validação/)
    })
  })

  describe('delete', () => {
    beforeEach(() => {
      client = makeClient({ data: null, error: null })
    })

    it('deleta filtrando id + user_id', async () => {
      const repo = createMedicineRepository({ client, getUserId })
      await repo.delete('med-1')
      const calls = client._builder._calls
      expect(calls).toEqual([
        ['delete', []],
        ['eq', ['id', 'med-1']],
        ['eq', ['user_id', FAKE_USER]],
      ])
    })

    it('throws on error', async () => {
      client = makeClient({ data: null, error: new Error('FK violation') })
      const repo = createMedicineRepository({ client, getUserId })
      await expect(repo.delete('med-1')).rejects.toThrow('FK violation')
    })
  })

  describe('parity: web vs mobile presets produzem CRUD idêntico', () => {
    it('create payload é idêntico para web/mobile (mesmo schema canônico)', async () => {
      const clientWeb = makeClient({ data: { id: 'w' }, error: null })
      const clientMob = makeClient({ data: { id: 'm' }, error: null })

      const repoWeb = createMedicineRepository({
        client: clientWeb, getUserId,
        listSelect: '*, stock(*), purchases(*)',
      })
      const repoMob = createMedicineRepository({
        client: clientMob, getUserId,
        listSelect: '*, protocols(id)',
      })

      await repoWeb.create(VALID_MEDICINE)
      await repoMob.create(VALID_MEDICINE)

      const webInsert = clientWeb._builder._calls.find(([m]) => m === 'insert')[1][0][0]
      const mobInsert = clientMob._builder._calls.find(([m]) => m === 'insert')[1][0][0]
      expect(webInsert).toEqual(mobInsert)
    })

    it('update e delete são idênticos entre presets', async () => {
      const clientWeb = makeClient({ data: { id: 'w' }, error: null })
      const clientMob = makeClient({ data: { id: 'm' }, error: null })
      const repoWeb = createMedicineRepository({ client: clientWeb, getUserId })
      const repoMob = createMedicineRepository({ client: clientMob, getUserId })

      await repoWeb.update('id-1', { name: 'Atualizado' })
      await repoMob.update('id-1', { name: 'Atualizado' })

      const webUpdate = clientWeb._builder._calls.find(([m]) => m === 'update')[1][0]
      const mobUpdate = clientMob._builder._calls.find(([m]) => m === 'update')[1][0]
      expect(webUpdate).toEqual(mobUpdate)
    })
  })
})
