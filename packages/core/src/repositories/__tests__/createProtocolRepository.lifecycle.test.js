// Lifecycle hooks de dose_instances na factory de protocolo (ADR-048, S2.5).
// Verifica os efeitos colaterais best-effort: create gera janela, pausa marca
// skipped_paused, mudança de agendamento faz wipe+regen. Mock cobre protocols + dose_instances.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createProtocolRepository } from '../createProtocolRepository.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const PROTOCOL_ROW = {
  id: 'p1',
  user_id: 'u1',
  name: 'Insulina Basal',
  frequency: 'diário',
  time_schedule: ['08:00'],
  dosage_per_intake: 10,
  start_date: '2026-01-01',
  end_date: null,
  active: true,
}

// Mock fluente que registra operações por tabela e resolve resultados plausíveis.
function makeClient() {
  const ops = [] // { table, calls: [[method, args]] }
  function builder(table) {
    const b = {
      _table: table,
      calls: [],
      _result: { data: table === 'protocols' ? PROTOCOL_ROW : [], error: null },
    }
    const chain = (name) => vi.fn(function (...a) { b.calls.push([name, a]); return b })
    b.select = chain('select')
    b.insert = chain('insert')
    b.upsert = chain('upsert')
    b.update = chain('update')
    b.delete = chain('delete')
    b.eq = chain('eq')
    b.in = chain('in')
    b.gt = chain('gt')
    b.gte = chain('gte')
    b.lte = chain('lte')
    b.not = chain('not')
    b.order = chain('order')
    b.single = vi.fn(function () { b.calls.push(['single', []]); return Promise.resolve(b._result) })
    b.maybeSingle = vi.fn(function () {
      b.calls.push(['maybeSingle', []])
      const res = b._result && Array.isArray(b._result.data) && b._result.data.length === 0
        ? { ...b._result, data: null }
        : b._result
      return Promise.resolve(res)
    })
    b.then = (resolve) => resolve(b._result)
    ops.push(b)
    return b
  }
  const client = { _ops: ops, from: vi.fn((t) => builder(t)) }
  return client
}

const getUserId = async () => 'u1'

function tableOps(client, table) {
  return client._ops.filter((b) => b._table === table)
}
function methodsFor(client, table) {
  return tableOps(client, table).flatMap((b) => b.calls.map(([m]) => m))
}

describe('createProtocolRepository — lifecycle dose_instances', () => {
  let client, repo
  beforeEach(() => {
    client = makeClient()
    repo = createProtocolRepository({ client, getUserId })
  })

  it('create → gera janela inicial (upsert em dose_instances + setGeneratedThrough)', async () => {
    await repo.create({
      medicine_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      name: 'Insulina Basal',
      frequency: 'diário',
      time_schedule: ['08:00'],
      dosage_per_intake: 10,
      start_date: '2026-01-01',
    })
    // houve upsert em dose_instances (geração)
    expect(methodsFor(client, 'dose_instances')).toContain('upsert')
    // setGeneratedThrough = update em protocols (além do insert original)
    const protocolUpdates = tableOps(client, 'protocols').filter((b) => b.calls.some(([m]) => m === 'update'))
    expect(protocolUpdates.length).toBeGreaterThan(0)
  })

  it('update active:false (pausa) → marca skipped_paused, NÃO regenera', async () => {
    await repo.update('p1', { active: false })
    const diOps = tableOps(client, 'dose_instances')
    const methods = diOps.flatMap((b) => b.calls.map(([m]) => m))
    // marcou skipped_paused (update em dose_instances) mas não fez upsert (sem regen)
    expect(methods).toContain('update')
    expect(methods).not.toContain('upsert')
  })

  it('update active:true (resume) → reativa skipped_paused (update status) + regen (upsert)', async () => {
    await repo.update('p1', { active: true })
    const diOps = tableOps(client, 'dose_instances')
    const methods = diOps.flatMap((b) => b.calls.map(([m]) => m))
    // reactivateFuturePaused = update em dose_instances filtrando status=skipped_paused
    expect(methods).toContain('update')
    const updatedToPending = diOps.some((b) =>
      b.calls.some(([m, a]) => m === 'update' && a[0]?.status === 'pending') &&
      b.calls.some(([m, a]) => m === 'eq' && a[0] === 'status' && a[1] === 'skipped_paused')
    )
    expect(updatedToPending).toBe(true)
    // e regenera a janela
    expect(methods).toContain('upsert')
  })

  it('update time_schedule → wipe (delete) + regen (upsert)', async () => {
    await repo.update('p1', { time_schedule: ['08:00', '20:00'] })
    const methods = methodsFor(client, 'dose_instances')
    expect(methods).toContain('delete') // wipeFuturePending
    expect(methods).toContain('upsert') // regeneração
  })

  it('update não-estrutural (name) → não toca dose_instances', async () => {
    await repo.update('p1', { name: 'Novo Nome' })
    expect(tableOps(client, 'dose_instances').length).toBe(0)
  })

  it('erro de geração é best-effort: create ainda retorna o protocolo', async () => {
    // força erro no caminho de dose_instances
    const brokenClient = makeClient()
    const origFrom = brokenClient.from
    brokenClient.from = vi.fn((t) => {
      const b = origFrom(t)
      if (t === 'dose_instances') b.upsert = vi.fn(() => { throw new Error('boom') })
      return b
    })
    const r = createProtocolRepository({ client: brokenClient, getUserId })
    const out = await r.create({
      medicine_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      name: 'Teste', frequency: 'diário', time_schedule: ['08:00'], dosage_per_intake: 1, start_date: '2026-01-01',
    })
    expect(out.id).toBe('p1') // protocolo criado apesar do erro de geração
  })
})
