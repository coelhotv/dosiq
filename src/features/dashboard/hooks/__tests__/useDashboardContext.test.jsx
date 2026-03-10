import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Mock Supabase ANTES de importar useDashboardContext
vi.mock('@shared/utils/supabase', () => ({
  supabase: { from: vi.fn() },
  getUserId: vi.fn(() => Promise.resolve('test-user-id')),
  getCurrentUser: vi.fn(() => Promise.resolve(null)),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}))

// Mock all service dependencies so DashboardProvider never hits Supabase
vi.mock('@medications/services/medicineService', () => ({
  medicineService: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@protocols/services/protocolService', () => ({
  protocolService: {
    getActive: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@shared/services/api/logService', () => ({
  logService: {
    getByDateRange: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

vi.mock('@shared/utils/queryCache', () => ({
  invalidateCache: vi.fn(),
}))

import { useDashboard, DashboardProvider } from '@dashboard/hooks/useDashboardContext.jsx'

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should throw error when used without provider', () => {
    expect(() => {
      renderHook(() => useDashboard())
    }).toThrow('useDashboard deve ser usado dentro de um DashboardProvider')
  })

  it('should provide default values when provider is used', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load — polling until async fetches complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.medicines).toBeDefined()
    expect(result.current.protocols).toBeDefined()
    expect(result.current.logs).toBeDefined()
    expect(result.current.stockSummary).toBeDefined()
    expect(result.current.stats).toBeDefined()
  })

  it('should provide refresh function', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.refresh).toBeDefined()
    expect(typeof result.current.refresh).toBe('function')
  })

  it('should provide lastSync timestamp', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.lastSync).toBeDefined()
    expect(new Date(result.current.lastSync)).toBeInstanceOf(Date)
  })

  it('should provide isDoseInToleranceWindow function', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isDoseInToleranceWindow).toBeDefined()
    expect(typeof result.current.isDoseInToleranceWindow).toBe('function')
  })

  it('should provide isFetching state', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isFetching).toBeDefined()
    expect(typeof result.current.isFetching).toBe('boolean')
  })

  it('should provide hasError state', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.hasError).toBeDefined()
    expect(typeof result.current.hasError).toBe('boolean')
  })

  it('should provide stats with rates', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stats).toBeDefined()
    expect(result.current.stats.score).toBeGreaterThanOrEqual(0)
    expect(result.current.stats.score).toBeLessThanOrEqual(100)
    expect(result.current.stats.rates).toBeDefined()
  })

  it('should provide stockSummary array', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stockSummary).toBeDefined()
    expect(Array.isArray(result.current.stockSummary)).toBe(true)
  })

  it('should provide protocols with nextDose', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.protocols).toBeDefined()
    expect(Array.isArray(result.current.protocols)).toBe(true)
  })
})

describe('useDashboard - Health Score Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should calculate score within valid range', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stats).toBeDefined()
    expect(result.current.stats.score).toBeGreaterThanOrEqual(0)
    expect(result.current.stats.score).toBeLessThanOrEqual(100)
  })

  it('should provide rates breakdown', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stats.rates).toBeDefined()
    expect(result.current.stats.rates.adherence).toBeDefined()
    expect(result.current.stats.rates.punctuality).toBeDefined()
    expect(result.current.stats.rates.stock).toBeDefined()
  })
})
