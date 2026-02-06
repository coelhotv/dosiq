import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDashboardContext, DashboardProvider } from '../useDashboardContext'

// Mock dos services
vi.mock('../../services/api', () => ({
  adherenceService: {
    getAdherenceStats: vi.fn(),
    getWeeklyAdherence: vi.fn()
  },
  stockService: {
    getLowStockMedicines: vi.fn(),
    getTotalQuantity: vi.fn()
  },
  protocolService: {
    getActiveProtocols: vi.fn()
  },
  logService: {
    getAll: vi.fn()
  }
}))

import * as api from '../../services/api'

describe('useDashboardContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should provide default values when no provider', () => {
    const { result } = renderHook(() => useDashboardContext())

    expect(result.current.smartAlerts).toEqual([])
    expect(result.current.healthScore).toBeNull()
    expect(result.current.lowStockItems).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('should load smart alerts on mount', async () => {
    const mockAlerts = [
      { id: 'alert-1', type: 'medication_due', title: 'Hora do remédio' }
    ]

    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 85,
      total_doses: 100,
      taken_doses: 85
    })

    api.stockService.getLowStockMedicines.mockResolvedValue([])
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    expect(result.current.smartAlerts).toBeDefined()
  })

  it('should calculate health score from adherence', async () => {
    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 90,
      total_doses: 100,
      taken_doses: 90
    })

    api.stockService.getLowStockMedicines.mockResolvedValue([])
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    // Health score should be based on adherence rate
    expect(result.current.healthScore).toBeGreaterThan(0)
  })

  it('should load low stock items', async () => {
    const mockLowStock = [
      {
        medicine_id: 'med-1',
        medicine_name: 'Dipirona',
        total_quantity: 5,
        threshold: 10
      }
    ]

    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 100,
      total_doses: 10,
      taken_doses: 10
    })

    api.stockService.getLowStockMedicines.mockResolvedValue(mockLowStock)
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    expect(result.current.lowStockItems).toEqual(mockLowStock)
  })

  it('should handle errors gracefully', async () => {
    console.error = vi.fn()

    api.adherenceService.getAdherenceStats.mockRejectedValue(new Error('API Error'))
    api.stockService.getLowStockMedicines.mockResolvedValue([])
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    // Should not throw, just have null health score
    expect(result.current.healthScore).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('should register medication and refresh data', async () => {
    const mockLog = { id: 'log-1', taken_at: '2024-01-15T10:00:00Z' }

    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 80,
      total_doses: 100,
      taken_doses: 80
    })

    api.stockService.getLowStockMedicines.mockResolvedValue([])
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([mockLog])
    api.logService.create.mockResolvedValue(mockLog)

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    await act(async () => {
      await result.current.onRegister({
        id: 'alert-1',
        medicine_id: 'med-1',
        quantity_taken: 1
      })
    })

    expect(api.logService.create).toHaveBeenCalled()
  })

  it('should dismiss alert', async () => {
    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 100,
      total_doses: 10,
      taken_doses: 10
    })

    api.stockService.getLowStockMedicines.mockResolvedValue([])
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    await act(async () => {
      result.current.onDismiss('alert-1')
    })

    // Alert should be removed from smartAlerts
    expect(result.current.smartAlerts.find(a => a.id === 'alert-1')).toBeUndefined()
  })
})

describe('useDashboardContext - Health Score Calculation', () => {
  it('should calculate excellent score for high adherence', async () => {
    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 95,
      total_doses: 100,
      taken_doses: 95
    })

    api.stockService.getLowStockMedicines.mockResolvedValue([])
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    expect(result.current.healthScore).toBeGreaterThanOrEqual(90)
  })

  it('should calculate poor score for low adherence', async () => {
    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 40,
      total_doses: 100,
      taken_doses: 40
    })

    api.stockService.getLowStockMedicines.mockResolvedValue([])
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    expect(result.current.healthScore).toBeLessThan(60)
  })

  it('should reduce score for low stock items', async () => {
    const mockLowStock = [
      { medicine_id: 'med-1', total_quantity: 5, threshold: 10 }
    ]

    api.adherenceService.getAdherenceStats.mockResolvedValue({
      adherence_rate: 90,
      total_doses: 100,
      taken_doses: 90
    })

    api.stockService.getLowStockMedicines.mockResolvedValue(mockLowStock)
    api.protocolService.getActiveProtocols.mockResolvedValue([])
    api.logService.getAll.mockResolvedValue([])

    const { result, waitForNextUpdate } = renderHook(() => useDashboardContext(), {
      wrapper: DashboardProvider
    })

    await waitForNextUpdate()

    // Score should be reduced due to low stock
    expect(result.current.healthScore).toBeLessThan(90)
    expect(result.current.scoreBreakdown).toBeDefined()
    expect(result.current.scoreBreakdown.stock).toBeDefined()
  })
})
