// Testes — createTitrationRepository (029 F2 / T006).
//
// Garante: filtros por user_id em toda leitura/escrita; `user_id` do DONO injetado em titrations
// E em titration_steps (AP-293 — nunca do payload); ordenação de etapas por position; propagação
// de erro Supabase. Mock builder fluente — não toca Supabase real.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTitrationRepository } from '../createTitrationRepository'

function makeBuilder(result: any) {
  const builder: any = {
    _calls: [],
    select: vi.fn(function (this: any, ...args: any[]) { this._calls.push(['select', args]); return this }),
    insert: vi.fn(function (this: any, ...args: any[]) { this._calls.push(['insert', args]); return this }),
    update: vi.fn(function (this: any, ...args: any[]) { this._calls.push(['update', args]); return this }),
    delete: vi.fn(function (this: any, ...args: any[]) { this._calls.push(['delete', args]); return this }),
    eq:     vi.fn(function (this: any, ...args: any[]) { this._calls.push(['eq', args]); return this }),
    order:  vi.fn(function (this: any, ...args: any[]) { this._calls.push(['order', args]); return this }),
    single: vi.fn(function (this: any)                 { this._calls.push(['single', []]); return Promise.resolve(result) }),
    then:   (resolve: any) => resolve(result),
  }
  return builder
}

function makeClient(result: any) {
  const builder = makeBuilder(result)
  const client: any = {
    _builder: builder,
    _from: null,
    from: vi.fn((table: any) => { client._from = table; return builder }),
  }
  return client
}

const FAKE_USER = 'user-uuid-123'
const getUserId = async () => FAKE_USER

const VALID_STEP = {
  titration_id: 'tit-1',
  position: 0,
  medicine_id: 'med-1',
  dose: 0.25,
  intake_unit: 'mg' as const,
  duration_days: 28,
}

describe('createTitrationRepository', () => {
  let client: any

  beforeEach(() => {
    client = makeClient({ data: [{ id: 'tit-1' }], error: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('lança se client ausente', () => {
    expect(() => createTitrationRepository({ getUserId } as any)).toThrow(/client/)
  })

  it('lança se getUserId não for função', () => {
    expect(() => createTitrationRepository({ client, getUserId: null } as any)).toThrow(/getUserId/)
  })

  describe('titrations', () => {
    it('getAll filtra por user_id + ordena desc por created_at', async () => {
      const repo = createTitrationRepository({ client, getUserId })
      await repo.getAll()
      expect(client.from).toHaveBeenCalledWith('titrations')
      expect(client._builder._calls).toEqual([
        ['select', ['*']],
        ['eq', ['user_id', FAKE_USER]],
        ['order', ['created_at', { ascending: false }]],
      ])
    })

    it('getAll retorna [] quando data null', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createTitrationRepository({ client, getUserId })
      expect(await repo.getAll()).toEqual([])
    })

    it('getById seleciona etapas aninhadas + filtra id + user_id + single', async () => {
      client = makeClient({ data: { id: 'tit-1', steps: [] }, error: null })
      const repo = createTitrationRepository({ client, getUserId })
      await repo.getById('tit-1')
      expect(client._builder._calls).toEqual([
        ['select', ['*, steps:titration_steps(*)']],
        ['eq', ['id', 'tit-1']],
        ['eq', ['user_id', FAKE_USER]],
        ['order', ['position', { referencedTable: 'titration_steps', ascending: true }]],
        ['single', []],
      ])
    })

    it('create injeta user_id do dono', async () => {
      client = makeClient({ data: { id: 'new-1' }, error: null })
      const repo = createTitrationRepository({ client, getUserId })
      await repo.create({ treatment_plan_id: 'plan-9' })
      const insertCall = client._builder._calls.find(([m]: any) => m === 'insert')
      expect(insertCall[1][0]).toEqual([
        expect.objectContaining({ treatment_plan_id: 'plan-9', user_id: FAKE_USER }),
      ])
    })

    it('delete filtra id + user_id', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createTitrationRepository({ client, getUserId })
      await repo.delete('tit-1')
      expect(client._builder._calls).toEqual([
        ['delete', []],
        ['eq', ['id', 'tit-1']],
        ['eq', ['user_id', FAKE_USER]],
      ])
    })

    it('propaga erro Supabase', async () => {
      client = makeClient({ data: null, error: new Error('boom') })
      const repo = createTitrationRepository({ client, getUserId })
      await expect(repo.getAll()).rejects.toThrow('boom')
    })
  })

  describe('titration_steps (AP-293)', () => {
    it('getSteps filtra titration_id + user_id + ordena por position asc', async () => {
      client = makeClient({ data: [], error: null })
      const repo = createTitrationRepository({ client, getUserId })
      await repo.getSteps('tit-1')
      expect(client.from).toHaveBeenCalledWith('titration_steps')
      expect(client._builder._calls).toEqual([
        ['select', ['*']],
        ['eq', ['titration_id', 'tit-1']],
        ['eq', ['user_id', FAKE_USER]],
        ['order', ['position', { ascending: true }]],
      ])
    })

    it('createStep injeta user_id do DONO, nunca do payload', async () => {
      client = makeClient({ data: { id: 's-1' }, error: null })
      const repo = createTitrationRepository({ client, getUserId })
      // payload malicioso com user_id de outro dono deve ser sobrescrito
      await repo.createStep({ ...VALID_STEP, user_id: 'attacker' } as any)
      const insertCall = client._builder._calls.find(([m]: any) => m === 'insert')
      const row = insertCall[1][0][0]
      expect(row.user_id).toBe(FAKE_USER)
      expect(row.medicine_id).toBe('med-1')
    })

    it('createSteps insere lote com user_id do dono em cada linha', async () => {
      client = makeClient({ data: [{ id: 's-1' }, { id: 's-2' }], error: null })
      const repo = createTitrationRepository({ client, getUserId })
      await repo.createSteps([VALID_STEP, { ...VALID_STEP, position: 1, dose: 0.5 }])
      const insertCall = client._builder._calls.find(([m]: any) => m === 'insert')
      const rows = insertCall[1][0]
      expect(rows).toHaveLength(2)
      expect(rows.every((r: any) => r.user_id === FAKE_USER)).toBe(true)
    })

    it('createSteps com lista vazia não chama Supabase', async () => {
      const repo = createTitrationRepository({ client, getUserId })
      expect(await repo.createSteps([])).toEqual([])
      expect(client.from).not.toHaveBeenCalled()
    })

    it('updateStep filtra id + user_id', async () => {
      client = makeClient({ data: { id: 's-1' }, error: null })
      const repo = createTitrationRepository({ client, getUserId })
      await repo.updateStep('s-1', { status: 'current' })
      const calls = client._builder._calls
      expect(calls[0]).toEqual(['update', [expect.objectContaining({ status: 'current' })]])
      expect(calls[1]).toEqual(['eq', ['id', 's-1']])
      expect(calls[2]).toEqual(['eq', ['user_id', FAKE_USER]])
    })

    it('deleteStep filtra id + user_id', async () => {
      client = makeClient({ data: null, error: null })
      const repo = createTitrationRepository({ client, getUserId })
      await repo.deleteStep('s-1')
      expect(client._builder._calls).toEqual([
        ['delete', []],
        ['eq', ['id', 's-1']],
        ['eq', ['user_id', FAKE_USER]],
      ])
    })
  })
})
