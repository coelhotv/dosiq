import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDashboard, DashboardProvider } from '../useDashboardContext'

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

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.medicines).toBeDefined()
    expect(result.current.protocols).toBeDefined()
    expect(result.current.logs).toBeDefined()
    expect(result.current.stockSummary).toBeDefined()
    expect(result.current.stats).toBeDefined()
    expect(result.current.isLoading).toBe(false)
  })

  it('should provide refresh function', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.refresh).toBeDefined()
    expect(typeof result.current.refresh).toBe('function')
  })

  it('should provide lastSync timestamp', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.lastSync).toBeDefined()
    expect(new Date(result.current.lastSync)).toBeInstanceOf(Date)
  })

  it('should provide isDoseInToleranceWindow function', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.isDoseInToleranceWindow).toBeDefined()
    expect(typeof result.current.isDoseInToleranceWindow).toBe('function')
  })

  it('should provide isFetching state', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.isFetching).toBeDefined()
    expect(typeof result.current.isFetching).toBe('boolean')
  })

  it('should provide hasError state', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.hasError).toBeDefined()
    expect(typeof result.current.hasError).toBe('boolean')
  })

  it('should provide stats with rates', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
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

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.stockSummary).toBeDefined()
    expect(Array.isArray(result.current.stockSummary)).toBe(true)
  })

  it('should provide protocols with nextDose', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
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

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.stats).toBeDefined()
    expect(result.current.stats.score).toBeGreaterThanOrEqual(0)
    expect(result.current.stats.score).toBeLessThanOrEqual(100)
  })

  it('should provide rates breakdown', async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: DashboardProvider,
    })

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(result.current.stats.rates).toBeDefined()
    expect(result.current.stats.rates.adherence).toBeDefined()
    expect(result.current.stats.rates.punctuality).toBeDefined()
    expect(result.current.stats.rates.stock).toBeDefined()
  })
})
