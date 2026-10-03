// useTreatmentList.archived.test.ts — spec 094 PO-2 (web)
// Excluir tratamento ARQUIVA no banco; a lista viva (abas ativo/pausado/finalizado) não pode
// trazer o arquivado de volta como "finalizado"/"pausado".

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const calls: Array<[string, string, unknown[]]> = []

function chain(table: string, result: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order']) {
    c[m] = (...args: unknown[]) => {
      calls.push([table, m, args])
      return c
    }
  }
  c.then = (resolve: (v: unknown) => unknown) => resolve(result)
  return c
}

vi.mock('@shared/utils/supabase', () => ({
  getUserId: vi.fn(() => Promise.resolve('user-1')),
  supabase: {
    from: vi.fn((table: string) => chain(table, { data: [], error: null })),
  },
}))
vi.mock('@services/api/adherenceService', () => ({
  adherenceService: { calculateAllProtocolsAdherence: vi.fn(() => Promise.resolve([])) },
}))
vi.mock('@shared/services', () => ({
  stockService: { getStockSummary: vi.fn(() => Promise.resolve({})) },
}))

import { useTreatmentList } from '../useTreatmentList'

describe('useTreatmentList — 094 arquivado fora da lista viva', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    calls.length = 0
  })

  it('a query de protocols filtra archived_at IS NULL', async () => {
    const { result } = renderHook(() => useTreatmentList())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls).toContainEqual(['protocols', 'is', ['archived_at', null]])
  })
})
