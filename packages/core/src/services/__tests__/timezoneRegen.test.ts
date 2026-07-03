// timezoneRegen.test.js — regen de doses ao mudar de fuso (F4.3f.2)
// Framework: Vitest (@dosiq/web roda os testes do core)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock do planner + repo → isola a orquestração do helper (a semântica de
// wipe/geração já é coberta pelos testes do repo e do planner).
vi.mock('../doseInstancePlanner.js', () => ({
  computeWindowEnd: vi.fn(() => '2026-07-01T00:00:00.000Z'),
  planWindow: vi.fn(async () => 5),
}))
const wipeFuturePending = vi.fn(async () => {})
vi.mock('../../repositories/createDoseInstanceRepository.js', () => ({
  createDoseInstanceRepository: vi.fn(() => ({ wipeFuturePending })),
}))

import { hasFuturePendingDoses, regenActiveProtocolsForTz } from '../timezoneRegen'
import { planWindow } from '../doseInstancePlanner'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'

const mockedPlanWindow = vi.mocked(planWindow)
const asClient = (c: unknown) => c as SupabaseClient<Database>

// Client mínimo: `.from(table)` despacha por tabela.
function makeClient({ pendingCount, pendingError, protocols, protocolsError, throws }: { pendingCount?: number; pendingError?: unknown; protocols?: unknown[]; protocolsError?: unknown; throws?: boolean } = {}) {
  return asClient({
    from: vi.fn((table) => {
      if (table === 'dose_instances') {
        // head-count: select().eq().eq().gt() → { count, error }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gt: async () => {
                  if (throws) throw new Error('boom')
                  return { count: pendingCount ?? 0, error: pendingError ?? null }
                },
              }),
            }),
          }),
        }
      }
      // protocols: select().eq().eq().lte().or() → { data, error }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              lte: () => ({
                or: async () => {
                  if (throws) throw new Error('boom')
                  return { data: protocols ?? [], error: protocolsError ?? null }
                },
              }),
            }),
          }),
        }),
      }
    }),
  })
}

beforeEach(() => {
  wipeFuturePending.mockClear()
  mockedPlanWindow.mockClear()
})
afterEach(() => vi.clearAllMocks())

describe('hasFuturePendingDoses', () => {
  it('true quando count > 0', async () => {
    expect(await hasFuturePendingDoses(makeClient({ pendingCount: 3 }), 'u1')).toBe(true)
  })
  it('false quando count 0 / erro / sem userId', async () => {
    expect(await hasFuturePendingDoses(makeClient({ pendingCount: 0 }), 'u1')).toBe(false)
    expect(await hasFuturePendingDoses(makeClient({ pendingError: { code: 'X' } }), 'u1')).toBe(false)
    expect(await hasFuturePendingDoses(makeClient({ pendingCount: 9 }), null)).toBe(false)
  })
  it('nunca lança — exceção vira false', async () => {
    expect(await hasFuturePendingDoses(makeClient({ throws: true }), 'u1')).toBe(false)
  })
})

describe('regenActiveProtocolsForTz', () => {
  it('regenera cada tratamento ativo no tz de destino', async () => {
    const client = makeClient({ protocols: [{ id: 'p1' }, { id: 'p2' }] })
    const res = await regenActiveProtocolsForTz({ client, userId: 'u1', tz: 'Europe/London' })

    expect(res).toEqual({ processed: 2, regenerated: 10, failed: 0 })
    expect(wipeFuturePending).toHaveBeenCalledTimes(2)
    expect(wipeFuturePending).toHaveBeenCalledWith('p1')
    expect(mockedPlanWindow).toHaveBeenCalledTimes(2)
    // tz de destino propagado à geração
    expect(mockedPlanWindow.mock.calls[0][0]).toMatchObject({ tz: 'Europe/London' })
  })

  it('sem tratamento ativo → noop', async () => {
    const client = makeClient({ protocols: [] })
    const res = await regenActiveProtocolsForTz({ client, userId: 'u1', tz: 'Europe/London' })
    expect(res).toEqual({ processed: 0, regenerated: 0, failed: 0 })
    expect(mockedPlanWindow).not.toHaveBeenCalled()
  })

  it('best-effort: falha num tratamento não derruba o lote', async () => {
    mockedPlanWindow.mockImplementationOnce(async () => { throw new Error('gen fail') })
    const client = makeClient({ protocols: [{ id: 'p1' }, { id: 'p2' }] })
    const res = await regenActiveProtocolsForTz({ client, userId: 'u1', tz: 'Europe/London' })
    expect(res.processed).toBe(2)
    expect(res.failed).toBe(1)
    expect(res.regenerated).toBe(5) // só o 2º teve sucesso
  })

  it('erro ao buscar protocolos → zeros, sem regen', async () => {
    const client = makeClient({ protocolsError: { code: 'X' } })
    const res = await regenActiveProtocolsForTz({ client, userId: 'u1', tz: 'Europe/London' })
    expect(res).toEqual({ processed: 0, regenerated: 0, failed: 0 })
    expect(mockedPlanWindow).not.toHaveBeenCalled()
  })

  it('sem client/userId → zeros', async () => {
    expect(await regenActiveProtocolsForTz({ client: null as unknown as SupabaseClient<Database>, userId: 'u1', tz: 'X' }))
      .toEqual({ processed: 0, regenerated: 0, failed: 0 })
    expect(await regenActiveProtocolsForTz({ client: makeClient({}), userId: null, tz: 'X' }))
      .toEqual({ processed: 0, regenerated: 0, failed: 0 })
  })
})
