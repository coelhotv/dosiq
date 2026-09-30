import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

let mockMode = 'simple'

vi.mock('@dashboard/hooks/useComplexityMode', () => ({
  useComplexityMode: () => ({ mode: mockMode }),
}))
vi.mock('@dashboard/hooks/useDashboardContext', () => ({
  useDashboard: () => ({ refresh: vi.fn() }),
}))
vi.mock('@protocols/hooks/useTreatmentList', () => ({
  useTreatmentList: () => ({
    activeItems: [],
    pausedItems: [],
    finishedItems: [],
    activeGroups: [],
    pausedGroups: [],
    finishedGroups: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
vi.mock('@shared/services', () => ({
  cachedMedicineService: { getAll: () => Promise.resolve([]), getById: vi.fn() },
  cachedTreatmentPlanService: { getAll: () => Promise.resolve([]), delete: vi.fn() },
  cachedProtocolService: { getById: vi.fn(), delete: vi.fn() },
}))

import { useTreatmentsState } from '@protocols/hooks/useTreatmentsState'

describe('useTreatmentsState — densidade (tudo que não é simple é detalhado)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it.each([
    ['simple', false],
    ['moderate', true],
    ['complex', true],
  ])('mode %s → isComplex %s (agrupa por plano)', (mode, expected) => {
    mockMode = mode
    const { result } = renderHook(() => useTreatmentsState(vi.fn()))
    expect(result.current.isComplex).toBe(expected)
  })
})
