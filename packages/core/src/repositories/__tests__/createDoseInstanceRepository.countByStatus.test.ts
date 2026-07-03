// Tests — createDoseInstanceRepository#countByStatus (Fase 3 — adesão por status)

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDoseInstanceRepository } from '../createDoseInstanceRepository'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

/**
 * Builder encadeável que resolve `result` via thenable (await no fim do chain).
 * Cada chamada anota em `_calls` para inspeção de args.
 */
function makeBuilder(result) {
  const builder = {
    _calls: [],
    select: vi.fn(function (...a) { this._calls.push(['select', a]); return this }),
    eq:     vi.fn(function (...a) { this._calls.push(['eq', a]); return this }),
    gte:    vi.fn(function (...a) { this._calls.push(['gte', a]); return this }),
    lte:    vi.fn(function (...a) { this._calls.push(['lte', a]); return this }),
    then:   (resolve) => resolve(result),
  }
  return builder
}

/**
 * Client que retorna o MESMO builder para todas as chamadas a .from(),
 * acumulando calls de todas as queries (5 status).
 * Para os testes de contagem, passamos uma factory de result por chamada.
 */
function makeMultiClient(resultsPerCall) {
  let callIndex = 0
  const builders = resultsPerCall.map((r) => makeBuilder(r))
  const client = {
    _builders: builders,
    from: vi.fn(() => {
      const b = builders[callIndex % builders.length]
      callIndex++
      return b
    }),
  }
  return client as any
}

function makeClient(result) {
  return makeMultiClient(Array(5).fill(result))
}

const FROM = '2026-05-01T00:00:00Z'
const TO   = '2026-05-31T23:59:59Z'
const USER = 'u-test'

describe('countByStatus', () => {
  it('retorna as 5 chaves com counts corretos por status', async () => {
    // Cada builder resolve com um count diferente para provar mapeamento 1:1
    const counts = [3, 7, 12, 1, 0] // taken, missed, pending, skipped_paused, skipped_user
    const client = makeMultiClient(counts.map((n) => ({ count: n, error: null })))
    const repo = createDoseInstanceRepository({ client })

    const out = await repo.countByStatus({ userId: USER, fromTs: FROM, toTs: TO })

    expect(out).toEqual({
      taken:          3,
      missed:         7,
      pending:        12,
      skipped_paused: 1,
      skipped_user:   0,
    })
    // Deve fazer exatamente 5 queries (uma por status)
    expect(client.from).toHaveBeenCalledTimes(5)
  })

  it('inclui .eq("protocol_id", ...) quando protocolId é fornecido', async () => {
    const client = makeClient({ count: 2, error: null })
    const repo = createDoseInstanceRepository({ client })

    await repo.countByStatus({ userId: USER, protocolId: 'proto-1', fromTs: FROM, toTs: TO })

    // Todos os builders devem ter recebido .eq('protocol_id', 'proto-1')
    for (const b of client._builders) {
      expect(b.eq).toHaveBeenCalledWith('protocol_id', 'proto-1')
    }
  })

  it('NÃO chama .eq("protocol_id", ...) quando protocolId é omitido', async () => {
    const client = makeClient({ count: 0, error: null })
    const repo = createDoseInstanceRepository({ client })

    await repo.countByStatus({ userId: USER, fromTs: FROM, toTs: TO })

    for (const b of client._builders) {
      const protocolEqCalls = b._calls.filter(
        ([name, args]) => name === 'eq' && args[0] === 'protocol_id'
      )
      expect(protocolEqCalls).toHaveLength(0)
    }
  })

  it('count: null vira 0 (R-104: ?? 0)', async () => {
    const client = makeClient({ count: null, error: null })
    const repo = createDoseInstanceRepository({ client })

    const out = await repo.countByStatus({ userId: USER, fromTs: FROM, toTs: TO })

    expect(out.taken).toBe(0)
    expect(out.missed).toBe(0)
    expect(out.pending).toBe(0)
    expect(out.skipped_paused).toBe(0)
    expect(out.skipped_user).toBe(0)
  })

  it('erro do Supabase → rejeita com o mesmo erro', async () => {
    const boom = new Error('db-error')
    const client = makeClient({ count: null, error: boom })
    const repo = createDoseInstanceRepository({ client })

    await expect(
      repo.countByStatus({ userId: USER, fromTs: FROM, toTs: TO })
    ).rejects.toThrow('db-error')
  })
})
