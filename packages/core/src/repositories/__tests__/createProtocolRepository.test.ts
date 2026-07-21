// Parity tests — createProtocolRepository (Fase 2 T3.3)
//
// Garante que web e mobile, ao injetarem suas opções/transforms, produzem:
//   - As mesmas chamadas Supabase (table, filter, payload)
//   - O mesmo formato de erro de validação
//   - Transforms são aplicados em getAll/getActive/getById
//
// Não tocamos no Supabase real — mock builder fluente (espelha createMedicineRepository.test.js).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createProtocolRepository } from '../createProtocolRepository'

// ---------- Mock Supabase fluent builder ----------
function makeBuilder(result: any) {
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
    then:   (resolve: any) => resolve(result),
  }
  return builder
}

function makeClient(result: any) {
  const builder = makeBuilder(result)
  const client = {
    _builder: builder,
    _from: null,
    from: vi.fn((table: any) => { client._from = table; return builder }),
  }
  return client as any
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

// 029 F6: a fixture com escada N1 (`titration_schedule`/`titration_status`/
// `current_stage_index`) morreu com as colunas. A escada é `titrations` + `titration_steps`,
// criada pelo fluxo próprio — o `create()` de tratamento não a toca mais.

// ---------- Suite ----------
describe('createProtocolRepository — parity', () => {
  let client: any

  beforeEach(() => {
    client = makeClient({ data: [{ id: 'p-1', name: 'Atenolol' }], error: null })
  })

  // ── Constructor validation ────────────────────────────────────────────────

  it('throws se client ausente', () => {
    expect(() => createProtocolRepository({ getUserId } as any)).toThrow(/client/)
  })

  it('throws se getUserId não for função', () => {
    expect(() => createProtocolRepository({ client, getUserId: null } as any)).toThrow(/getUserId/)
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
      const lteCall = calls.find(([m]: any) => m === 'lte')
      expect(lteCall).toBeDefined()
      expect(lteCall[1][0]).toBe('start_date')
      const orCall = calls.find(([m]: any) => m === 'or')
      expect(orCall).toBeDefined()
      expect(orCall[1][0]).toMatch(/end_date\.is\.null/)
    })

    it('aceita date customizado e usa no lte/or', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.getActive('2026-06-01')
      const calls = client._builder._calls
      const lteCall = calls.find(([m]: any) => m === 'lte')
      expect(lteCall[1]).toEqual(['start_date', '2026-06-01'])
      const orCall = calls.find(([m]: any) => m === 'or')
      expect(orCall[1][0]).toContain('2026-06-01')
    })

    it('aplica listTransform no resultado', async () => {
      client = makeClient({ data: [{ id: 'p-1' }, { id: 'p-2' }], error: null })
      const repo = createProtocolRepository({
        client, getUserId,
        listTransform: (rows: any) => rows.map((r: any) => ({ ...r, active: true })),
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
        detailTransform: (row: any) => ({ ...row, decorated: true }),
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

    it('validation ok → insert recebe payload com user_id', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.create(VALID_PROTOCOL)
      const insertCall = client._builder._calls.find(([m]: any) => m === 'insert')
      expect(insertCall[1][0]).toEqual([
        expect.objectContaining({
          name: 'Atenolol 25mg',
          dosage_per_intake: 25,
          user_id: FAKE_USER,
        }),
      ])
    })

    // 🔴 029 F6 — guarda do DROP. As 4 colunas N1 não existem mais em `protocols`: qualquer
    // uma delas no payload é `42703` em TODO cadastro de tratamento, web e mobile. Este é o
    // teste que falha se alguém reintroduzir o default "pra manter compatibilidade" — e é a
    // única barreira automática, porque `insert` recebe um objeto livre: nem tsc nem lint
    // reclamam de uma chave a mais (AP-300).
    it('insert NÃO envia nenhuma coluna de titulação N1 (dropadas — R-295)', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.create(VALID_PROTOCOL)
      const insertCall = client._builder._calls.find(([m]: any) => m === 'insert')
      const payload = insertCall[1][0][0]
      expect(payload).not.toHaveProperty('titration_schedule')
      expect(payload).not.toHaveProperty('titration_status')
      expect(payload).not.toHaveProperty('current_stage_index')
      expect(payload).not.toHaveProperty('stage_started_at')
    })

    it('usa writeSelect customizado se passado', async () => {
      const customSelect = 'id, name'
      client = makeClient({ data: { id: 'new-p-3' }, error: null })
      const repo = createProtocolRepository({ client, getUserId, writeSelect: customSelect })
      await repo.create(VALID_PROTOCOL)
      const selectCall = client._builder._calls.find(
        ([m, args]: any) => m === 'select' && args[0] === customSelect
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
      const updateCall = calls.find(([m]: any) => m === 'update')
      expect(updateCall[1][0]).toMatchObject({ name: 'Nome Atualizado' })
      expect(calls).toContainEqual(['eq', ['id', 'p-1']])
      expect(calls).toContainEqual(['eq', ['user_id', FAKE_USER]])
    })

    // 🔴 Regressão: update parcial NÃO pode arrastar defaults injetados pelo Zod. Pausar um
    // tratamento (só `{active}`) zerava `weekdays`/`titration_status`/`time_schedule` no banco.
    it('update parcial persiste SÓ as chaves enviadas (não os defaults do Zod)', async () => {
      const repo = createProtocolRepository({ client, getUserId })
      await repo.update('p-1', { active: false })
      const updateCall = client._builder._calls.find(([m]: any) => m === 'update')
      const payload = updateCall[1][0]
      expect(payload).toEqual({ active: false })
      // Os campos que o Zod injeta como default NÃO podem ir ao banco num update parcial.
      expect(payload).not.toHaveProperty('weekdays')
      expect(payload).not.toHaveProperty('time_schedule')
      // 029 F6: as colunas N1 saíram do schema, então já não são defaults injetáveis — mas a
      // asserção fica: se alguém as redeclarar no Zod, o update parcial volta a arrastá-las
      // para um banco onde elas não existem mais (42703), e este teste avisa.
      expect(payload).not.toHaveProperty('titration_status')
      expect(payload).not.toHaveProperty('current_stage_index')
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

  // 029 F3.1 (T017i): removida a suíte de `advanceTitrationStage` (função deletada — write-path
  // N1 sem chamador; ver AP-301).
})
