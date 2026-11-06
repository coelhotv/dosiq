import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSupplyRunwayRepository, SUPPLY_STEP_SELECT, SUPPLY_INSTANCE_SELECT } from '../createSupplyRunwayRepository'

// 105 Fatia B — repositório de leitura. Prova: escopo por usuário, filtros e PAGINAÇÃO (AP-186:
// PostgREST trunca em ~1000 sem erro), e que lista vazia de medicamentos não vai ao banco.

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const USER = 'user-1'

/** Builder fluente falso: registra as chamadas; `.range(a,b)` devolve a fatia de `rows`. */
function makeClient(rows: unknown[], { error = null as unknown, single = null as unknown } = {}) {
  const calls: Array<[string, unknown[]]> = []
  const builder: any = {}
  for (const m of ['select', 'eq', 'in', 'gte', 'order']) {
    builder[m] = vi.fn((...a: unknown[]) => { calls.push([m, a]); return builder })
  }
  builder.range = vi.fn((from: number, to: number) => {
    calls.push(['range', [from, to]])
    return Promise.resolve(error ? { data: null, error } : { data: rows.slice(from, to + 1), error: null })
  })
  builder.maybeSingle = vi.fn(() => Promise.resolve(error ? { data: null, error } : { data: single, error: null }))
  const client: any = { from: vi.fn((t: string) => { calls.push(['from', [t]]); return builder }) }
  return { client, calls, builder }
}

const repo = (client: any) => createSupplyRunwayRepository({ client, getUserId: async () => USER })

describe('createSupplyRunwayRepository', () => {
  it('getSteps: titration_steps do usuário, colunas do servidor, pagina até página incompleta', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: `s${i}` }))
    const { client, calls } = makeClient(rows)
    const out = await repo(client).getSteps()
    expect(out).toHaveLength(1500)
    expect(calls).toContainEqual(['from', ['titration_steps']])
    expect(calls).toContainEqual(['select', [SUPPLY_STEP_SELECT]])
    expect(calls).toContainEqual(['eq', ['user_id', USER]])
    expect(calls.filter(([m]) => m === 'range').map(([, a]) => a)).toEqual([[0, 999], [1000, 1999]])
  })

  it('getPendingInstances: só pendentes dos medicamentos pedidos, desde fromIso', async () => {
    const { client, calls } = makeClient([{ id: 'd1' }])
    const out = await repo(client).getPendingInstances(['m1'], '2026-11-04T00:00:00.000Z')
    expect(out).toEqual([{ id: 'd1' }])
    expect(calls).toContainEqual(['select', [SUPPLY_INSTANCE_SELECT]])
    expect(calls).toContainEqual(['eq', ['status', 'pending']])
    expect(calls).toContainEqual(['in', ['medicine_id', ['m1']]])
    expect(calls).toContainEqual(['gte', ['scheduled_for', '2026-11-04T00:00:00.000Z']])
  })

  it('getPendingInstances: lista vazia ⇒ [] sem ir ao banco', async () => {
    const { client } = makeClient([])
    expect(await repo(client).getPendingInstances([], 'x')).toEqual([])
    expect(client.from).not.toHaveBeenCalled()
  })

  it('erro do banco propaga (o chamador decide o fail-safe)', async () => {
    const { client } = makeClient([], { error: { code: '42501' } })
    await expect(repo(client).getSteps()).rejects.toEqual({ code: '42501' })
  })

  it('getProtocolOrigin: filtra por usuário; ausente ⇒ null', async () => {
    const { client, calls } = makeClient([], { single: null })
    expect(await repo(client).getProtocolOrigin('p1')).toBeNull()
    expect(calls).toContainEqual(['eq', ['user_id', USER]])
  })

  it('getMedicineSummaries: só os ids pedidos, do usuário; vazio ⇒ sem banco', async () => {
    const { client, calls, builder } = makeClient([])
    builder.in = vi.fn((...a: unknown[]) => { calls.push(['in', a]); return Promise.resolve({ data: [{ id: 'm', name: 'X' }], error: null }) })
    expect(await repo(client).getMedicineSummaries(['m'])).toEqual([{ id: 'm', name: 'X' }])
    expect(calls).toContainEqual(['in', ['id', ['m']]])
    expect(calls).toContainEqual(['eq', ['user_id', USER]])
    const empty = makeClient([])
    expect(await repo(empty.client).getMedicineSummaries([])).toEqual([])
    expect(empty.client.from).not.toHaveBeenCalled()
  })

  it('getMedicineName: nome ou null', async () => {
    const { client } = makeClient([], { single: { id: 'm', name: 'X' } })
    expect(await repo(client).getMedicineName('m')).toBe('X')
  })

  it('exige client e getUserId', () => {
    expect(() => createSupplyRunwayRepository({ client: null as any, getUserId: async () => USER })).toThrow()
    expect(() => createSupplyRunwayRepository({ client: {} as any, getUserId: null as any })).toThrow()
  })
})
