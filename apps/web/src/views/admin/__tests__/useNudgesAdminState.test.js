import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from 'vitest'

vi.mock('@services/api/nudgeAdminService', () => ({
  default: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggleActive: vi.fn(),
  },
}))

import { useNudgesAdminState } from '../useNudgesAdminState'
import nudgeAdminService from '@services/api/nudgeAdminService'

describe('useNudgesAdminState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('should initialize with default state', () => {
    nudgeAdminService.getAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
    })

    const { result } = renderHook(() => useNudgesAdminState())

    expect(result.current.nudges).toEqual([])
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(20)
  })

  it('should load nudges on mount', async () => {
    const mockData = {
      data: [{ id: 1, title: 'Test Nudge', is_active: true }],
      total: 1,
      page: 1,
      totalPages: 1,
    }

    nudgeAdminService.getAll.mockResolvedValue(mockData)

    const { result } = renderHook(() => useNudgesAdminState())

    await waitFor(() => {
      expect(result.current.nudges).toHaveLength(1)
    })

    expect(result.current.nudges[0].title).toBe('Test Nudge')
  })

  it('should handle create action', async () => {
    nudgeAdminService.getAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
    })

    nudgeAdminService.create.mockResolvedValue({
      id: 'nudge-1',
      title: 'New Nudge',
    })

    const { result } = renderHook(() => useNudgesAdminState())

    await act(async () => {
      await result.current.handleCreate({
        title: 'New Nudge',
        body: 'Test',
        target_view: 'dashboard',
        action_type: 'dismiss_only',
        platform: 'all',
      })
    })

    await waitFor(() => {
      expect(result.current.actionMessage).toBeDefined()
      expect(result.current.actionMessage.type).toBe('success')
    })

    expect(nudgeAdminService.create).toHaveBeenCalled()
  })

  it('should handle filter changes', async () => {
    nudgeAdminService.getAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
    })

    const { result } = renderHook(() => useNudgesAdminState())

    await act(async () => {
      result.current.setIsActiveFilter('true')
    })

    await waitFor(() => {
      expect(result.current.isActiveFilter).toBe('true')
    })
  })

  it('should handle pagination', async () => {
    nudgeAdminService.getAll.mockResolvedValue({
      data: [],
      total: 100,
      page: 1,
      totalPages: 5,
    })

    const { result } = renderHook(() => useNudgesAdminState())

    await act(async () => {
      result.current.setPage(2)
    })

    await waitFor(() => {
      expect(result.current.page).toBe(2)
    })
  })

  it('should auto-clear action message after 4s', async () => {
    vi.useFakeTimers()

    nudgeAdminService.getAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
    })

    nudgeAdminService.create.mockResolvedValue({ id: 1 })

    const { result } = renderHook(() => useNudgesAdminState())

    await act(async () => {
      await result.current.handleCreate({
        title: 'Test',
        body: 'Test',
        target_view: 'dashboard',
        action_type: 'dismiss_only',
        platform: 'all',
      })
    })

    expect(result.current.actionMessage).toBeDefined()

    await act(async () => {
      vi.advanceTimersByTime(4100)
    })

    expect(result.current.actionMessage).toBeNull()

    vi.useRealTimers()
  })
})
