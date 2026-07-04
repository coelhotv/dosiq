// Tests — markMissedDueInstances (sweep, writer #3) + re-anchor de missed (F2.5).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDoseInstanceRepository } from '../createDoseInstanceRepository'

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * Mock client com FILA de resultados: cada cadeia encadeável termina num `await`
 * (thenable) que consome o próximo resultado da fila, na ordem das queries.
 */
function makeQueueClient(queue) {
  const calls = []
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn((...a) => { calls.push(['update', a]); return builder }),
    eq: vi.fn((...a) => { calls.push(['eq', a]); return builder }),
    in: vi.fn((...a) => { calls.push(['in', a]); return builder }),
    lt: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve) => resolve(queue.shift() ?? { data: [], error: null }),
  }
  const client = { from: vi.fn(() => builder), _calls: calls }
  return client as any
}

const NOW = '2026-05-20T12:00:00.000Z'
// helpers de instante relativo a NOW
const minsAgo = (m) => new Date(Date.parse(NOW) - m * 60000).toISOString()

describe('markMissedDueInstances (sweep)', () => {
  it('marca como missed só pending cuja tolerância (por linha) expirou', async () => {
    const candidates = [
      { id: 'a', scheduled_for: minsAgo(180), tolerance_minutes: 120 }, // 180>120 → due
      { id: 'b', scheduled_for: minsAgo(30), tolerance_minutes: 120 },  // 30<120 → não
      { id: 'c', scheduled_for: minsAgo(90), tolerance_minutes: 60 },   // 90>60  → due
    ]
    const queue = [
      { data: candidates, error: null }, // página única do SELECT
      { data: [{ id: 'a' }, { id: 'c' }], error: null }, // UPDATE afetou 2
    ]
    const client = makeQueueClient(queue)
    const repo = createDoseInstanceRepository({ client })

    const missed = await repo.markMissedDueInstances({ now: NOW })
    expect(missed).toBe(2)
    // UPDATE reafirma status pending (guard de corrida, AP-185) e filtra os ids due.
    const updateEq = client._calls.find(([n, a]) => n === 'eq' && a[0] === 'status')
    expect(updateEq[1]).toEqual(['status', 'pending'])
    const inIds = client._calls.find(([n, a]) => n === 'in' && a[0] === 'id')
    expect(inIds[1][1]).toEqual(['a', 'c'])
  })

  it('nenhuma vencida → 0 e sem UPDATE', async () => {
    const queue = [
      { data: [{ id: 'b', scheduled_for: minsAgo(10), tolerance_minutes: 120 }], error: null },
    ]
    const client = makeQueueClient(queue)
    const repo = createDoseInstanceRepository({ client })
    const missed = await repo.markMissedDueInstances({ now: NOW })
    expect(missed).toBe(0)
    expect(client._calls.some(([n]) => n === 'update')).toBe(false)
  })

  it('erro no SELECT propaga (throw)', async () => {
    const client = makeQueueClient([{ data: null, error: new Error('boom') }])
    const repo = createDoseInstanceRepository({ client })
    await expect(repo.markMissedDueInstances({ now: NOW })).rejects.toThrow('boom')
  })
})

describe('markTaken — re-anchor de missed (self-heal F2.5)', () => {
  it('aceita pending E missed (não só pending)', async () => {
    const queue = [{ data: [{ id: 'di-1' }], error: null }]
    const client = makeQueueClient(queue)
    const repo = createDoseInstanceRepository({ client })

    const ok = await repo.markTaken('di-1', 'log-9')
    expect(ok).toBe(true)
    const statusIn = client._calls.find(([n, a]) => n === 'in' && a[0] === 'status')
    expect(statusIn[1][1]).toEqual(['pending', 'missed', 'skipped_user'])
  })

  it('no-op (já taken) → false', async () => {
    const client = makeQueueClient([{ data: [], error: null }])
    const repo = createDoseInstanceRepository({ client })
    expect(await repo.markTaken('di-1', 'log-9')).toBe(false)
  })
})
