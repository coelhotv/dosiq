// Parity tests — createProtocolRepository (Fase 2 T3.3)
//
// Garante que web e mobile, ao injetarem suas opções/transforms, produzem:
//   - As mesmas chamadas Supabase (table, filter, payload)
//   - O mesmo formato de erro de validação
//   - Transforms são aplicados em getAll/getActive/getById
//
// Não tocamos no Supabase real — mock builder fluente (espelha createMedicineRepository.test.js).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createProtocolRepository } from '../createProtocolRepository.js'

// ---------- Mock Supabase fluent builder ----------
function makeBuilder(result) {
  const builder = {
    _calls: [],
    select: vi.fn(function (...args) { this._calls.push(['select', args]); return this }),
    insert: vi.fn(function (...args) { this._calls.push(['insert', args]); return this }),
    update: vi.fn(function (...args) { this._calls.push(['update', args]); return this }),
    delete: vi.fn(function (...args) { this._calls.push(['delete', args]); return this }),
    eq:     vi.fn(function (...args) { this._calls.push(['eq', args]); return this }),
    lte:    vi.fn(function (...args) { this._calls.push(['lte', args]); return this }),
    or:     vi.fn(function (...args) { this._calls.push(['or', args]); return this }),
    order:  vi.fn(function (...args) { this._calls.push(['order', args]); return this }),
    single: vi.fn(function ()        { this._calls.push(['single', []]); return Promise.resolve(result) }),
    then:   (resolve) => resolve(result),
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

const FAKE_USER = 'user-123'
const getUserId = async () => FAKE_USER

// Fixture base para criação válida (sem titração)
const VALID_PROTOCOL = {
  medicine_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Atenolol 25mg',
  frequency: 'diário',
  time_schedule: ['08:00'],
  dosage_per_intake: 25,
  start_date: '2026-01-01',
}

// Fixture com titração (2 stages — exige titration_status='titulando')
const TITRATION_SCHEDULE = [
  { dosage: 25, duration_days: 14 },
  { dosage: 50, duration_days: 28 },
]
const VALID_PROTOCOL_TITRATION = {
  ...VALID_PROTOCOL,
  titration_schedule: TITRATION_SCHEDULE,
  titration_status: 'titulando',
  current_stage_index: 0,
}

// ---------- Suite ----------
describe('createProtocolRepository — parity', () => {
  let client

  beforeEach(() => {
    client = makeClient({ data: [{ id: 'p-1', name: 'Atenolol' }], error: null })
  })

  // ── Constructor validation ────────────────────────────────────────────────

  it('throws se client ausente', () => {
    expect(() => createProtocolRepository({ getUserId })).toThrow(/client/)
  })

  it('throws se getUserId não for função', () => {
    expect(() => createProtocolRepository({ client, getUserId: null })).toThrow(/getUserId/)
  })

  // ── getAll ────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('selects from protocols + eq user_id + order created_at desc', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.getAll()
      expect(client.from).toHaveBeenCalledWith('protocols')
      const calls = client._builder._calls
      expect(calls).toEqual([
        ['select', [expect.stringContaining('medicine:medicines')]],
        ['eq', ['user_id', FAKE_USER]],
        ['order', ['created_at', { ascending: false }]],
      ])
    })

    it('propaga erro do supabase', async () => {
      client = makeClient({ data: null, error: new Error('db down') })
      const repo = createProtocolRepository({ client, getUserId })
      await expect(repo.getAll()).rejects.toThrow('db down')
    })
  })

  // ── getActive ─────────────────────────────────────────────────────────────

  describe('getActive', () => {
    it('aplica filtros active + lte start_date + or end_date com data padrão (getTodayLocal)', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.getActive()
      const calls = client._builder._calls
      expect(calls).toContainEqual(['eq', ['active', true]])
      const lteCall = calls.find(([m]) => m === 'lte')
      expect(lteCall).toBeDefined()
      expect(lteCall[1][0]).toBe('start_date')
      const orCall = calls.find(([m]) => m === 'or')
      expect(orCall).toBeDefined()
      expect(orCall[1][0]).toMatch(/end_date\.is\.null/)
    })

    it('aceita date customizado e usa no lte/or', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.getActive('2026-06-01')
      const calls = client._builder._calls
      const lteCall = calls.find(([m]) => m === 'lte')
      expect(lteCall[1]).toEqual(['start_date', '2026-06-01'])
      const orCall = calls.find(([m]) => m === 'or')
      expect(orCall[1][0]).toContain('2026-06-01')
    })

    it('aplica listTransform no resultado', async () => {
      client = makeClient({ data: [{ id: 'p-1' }, { id: 'p-2' }], error: null })
      const repo = createProtocolRepository({
        client, getUserId,
        listTransform: (rows) => rows.map((r) => ({ ...r, active: true })),
      })
      const result = await repo.getActive('2026-01-01')
      expect(result).toEqual([{ id: 'p-1', active: true }, { id: 'p-2', active: true }])
    })
  })

  // ── getById ───────────────────────────────────────────────────────────────

  describe('getById', () => {
    beforeEach(() => {
      client = makeClient({ data: { id: 'p-1', name: 'Atenolol' }, error: null })
    })

    it('select + eq id + eq user_id + .single()', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.getById('p-1')
      const calls = client._builder._calls
      expect(calls).toEqual([
        ['select', [expect.stringContaining('medicine:medicines')]],
        ['eq', ['id', 'p-1']],
        ['eq', ['user_id', FAKE_USER]],
        ['single', []],
      ])
    })

    it('aplica detailTransform', async () => {
      const repo = createProtocolRepository({
        client, getUserId,
        detailTransform: (row) => ({ ...row, decorated: true }),
      })
      const result = await repo.getById('p-1')
      expect(result).toEqual({ id: 'p-1', name: 'Atenolol', decorated: true })
    })
  })

  // ── getByMedicineId ───────────────────────────────────────────────────────

  describe('getByMedicineId', () => {
    it('filtra por medicine_id + user_id e retorna [] se data null', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createProtocolRepository({ client, getUserId })
      const result = await repo.getByMedicineId('med-uuid-999')
      expect(client.from).toHaveBeenCalledWith('protocols')
      const calls = client._builder._calls
      expect(calls).toContainEqual(['eq', ['medicine_id', 'med-uuid-999']])
      expect(calls).toContainEqual(['eq', ['user_id', FAKE_USER]])
      expect(result).toEqual([])
    })
  })

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      client = makeClient({ data: { id: 'new-p-1', ...VALID_PROTOCOL }, error: null })
    })

    it('validation fail → throws "Erro de validação"', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await expect(repo.create({ name: 'Incompleto' })).rejects.toThrow(/Erro de validação/)
    })

    it('validation ok → insert recebe payload com user_id e defaults de titulação', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.create(VALID_PROTOCOL)
      const insertCall = client._builder._calls.find(([m]) => m === 'insert')
      expect(insertCall[1][0]).toEqual([
        expect.objectContaining({
          name: 'Atenolol 25mg',
          dosage_per_intake: 25,
          user_id: FAKE_USER,
          titration_schedule: [],
          current_stage_index: 0,
          stage_started_at: null,
        }),
      ])
    })

    it('titration_schedule preenchido → stage_started_at é string (getServerTimestamp)', async () => {
      client = makeClient({ data: { id: 'new-p-2', ...VALID_PROTOCOL_TITRATION }, error: null })
      const repo = createProtocolRepository({ client, getUserId })
      await repo.create(VALID_PROTOCOL_TITRATION)
      const insertCall = client._builder._calls.find(([m]) => m === 'insert')
      const payload = insertCall[1][0][0]
      expect(typeof payload.stage_started_at).toBe('string')
      expect(payload.stage_started_at).not.toBeNull()
    })

    it('usa writeSelect customizado se passado', async () => {
      const customSelect = 'id, name'
      client = makeClient({ data: { id: 'new-p-3' }, error: null })
      const repo = createProtocolRepository({ client, getUserId, writeSelect: customSelect })
      await repo.create(VALID_PROTOCOL)
      const selectCall = client._builder._calls.find(
        ([m, args]) => m === 'select' && args[0] === customSelect
      )
      expect(selectCall).toBeDefined()
    })
  })

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    beforeEach(() => {
      client = makeClient({ data: { id: 'p-1', name: 'Novo Nome' }, error: null })
    })

    it('validation fail → throws "Erro de validação"', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      // dosage_per_intake negativo deve falhar
      await expect(repo.update('p-1', { dosage_per_intake: -1 })).rejects.toThrow(/Erro de validação/)
    })

    it('validation ok → envia validated.data via .update()', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.update('p-1', { name: 'Nome Atualizado' })
      const calls = client._builder._calls
      const updateCall = calls.find(([m]) => m === 'update')
      expect(updateCall[1][0]).toMatchObject({ name: 'Nome Atualizado' })
      expect(calls).toContainEqual(['eq', ['id', 'p-1']])
      expect(calls).toContainEqual(['eq', ['user_id', FAKE_USER]])
    })
  })

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('chama .delete().eq(id).eq(user_id)', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createProtocolRepository({ client, getUserId })
      await repo.delete('p-1')
      const calls = client._builder._calls
      expect(calls).toEqual([
        ['delete', []],
        ['eq', ['id', 'p-1']],
        ['eq', ['user_id', FAKE_USER]],
      ])
    })
  })

  // ── advanceTitrationStage ─────────────────────────────────────────────────

  describe('advanceTitrationStage', () => {
    it('throws se protocol sem titration_schedule', async () => {
      // getById retorna protocolo sem schedule
      client = makeClient({ data: { id: 'p-1', titration_schedule: [], current_stage_index: 0 }, error: null })
      const repo = createProtocolRepository({ client, getUserId })
      await expect(repo.advanceTitrationStage('p-1')).rejects.toThrow(/titulação/)
    })

    it('próximo stage normal → update com nextIndex, dosage do nextStage, status=titulando', async () => {
      // getById retorna protocolo com 2 stages, current=0
      // update retorna o mesmo objeto (não importa o shape neste teste)
      const protocol = {
        id: 'p-1',
        titration_schedule: TITRATION_SCHEDULE,
        current_stage_index: 0,
      }
      let callCount = 0
      // Precisamos que getById use .single() e update também — fazemos um client
      // que alterna respostas: 1a chamada (getById→single) retorna protocol,
      // 2a chamada (update) retorna o updated.
      const builder = makeBuilder(null)
      let singleCallCount = 0
      builder.single = vi.fn(function () {
        singleCallCount++
        if (singleCallCount === 1) return Promise.resolve({ data: protocol, error: null })
        return Promise.resolve({ data: { ...protocol, current_stage_index: 1 }, error: null })
      })
      builder.then = (resolve) => {
        callCount++
        resolve({ data: [protocol], error: null })
      }
      const advClient = {
        _builder: builder,
        from: vi.fn(() => builder),
      }

      const repo = createProtocolRepository({ client: advClient, getUserId })
      await repo.advanceTitrationStage('p-1')

      const updateCall = builder._calls.find(([m]) => m === 'update')
      expect(updateCall[1][0]).toMatchObject({
        current_stage_index: 1,
        dosage_per_intake: 50, // nextStage.dosage
        titration_status: 'titulando',
      })
    })

    it('markAsCompleted=true → status=alvo_atingido mesmo no meio do schedule', async () => {
      const protocol = {
        id: 'p-1',
        titration_schedule: TITRATION_SCHEDULE,
        current_stage_index: 0,
      }
      const builder = makeBuilder(null)
      let singleCallCount = 0
      builder.single = vi.fn(function () {
        singleCallCount++
        if (singleCallCount === 1) return Promise.resolve({ data: protocol, error: null })
        return Promise.resolve({ data: { ...protocol, titration_status: 'alvo_atingido' }, error: null })
      })
      builder.then = (resolve) => resolve({ data: [protocol], error: null })
      const advClient = { _builder: builder, from: vi.fn(() => builder) }

      const repo = createProtocolRepository({ client: advClient, getUserId })
      await repo.advanceTitrationStage('p-1', true)

      const updateCall = builder._calls.find(([m]) => m === 'update')
      expect(updateCall[1][0]).toMatchObject({ titration_status: 'alvo_atingido' })
    })

    it('esgotou schedule (nextIndex >= length) → status=alvo_atingido, index=length-1', async () => {
      // current_stage_index=1, schedule length=2 → nextIndex=2 >= 2
      const protocol = {
        id: 'p-1',
        titration_schedule: TITRATION_SCHEDULE,
        current_stage_index: 1,
      }
      const builder = makeBuilder(null)
      let singleCallCount = 0
      builder.single = vi.fn(function () {
        singleCallCount++
        if (singleCallCount === 1) return Promise.resolve({ data: protocol, error: null })
        return Promise.resolve({ data: { ...protocol, titration_status: 'alvo_atingido' }, error: null })
      })
      builder.then = (resolve) => resolve({ data: [protocol], error: null })
      const advClient = { _builder: builder, from: vi.fn(() => builder) }

      const repo = createProtocolRepository({ client: advClient, getUserId })
      await repo.advanceTitrationStage('p-1')

      const updateCall = builder._calls.find(([m]) => m === 'update')
      expect(updateCall[1][0]).toMatchObject({
        titration_status: 'alvo_atingido',
        current_stage_index: 1, // length-1 = 2-1
      })
    })
  })
})
