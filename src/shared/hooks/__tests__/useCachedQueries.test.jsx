import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useCachedQueries,
  clearCache,
  cancelGarbageCollection,
  restartGarbageCollection,
} from '@shared/hooks/useCachedQuery'

// Disable interval-based GC during tests to save memory
beforeAll(() => {
  cancelGarbageCollection()
})

afterAll(() => {
  restartGarbageCollection()
})

describe('useCachedQueries', () => {
  beforeEach(() => {
    clearCache()
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  afterEach(() => {
    clearCache()
    vi.clearAllMocks()
    vi.resetAllMocks()
    vi.clearAllTimers()
    if (global.gc) global.gc()
  })

  it('should fetch multiple queries in parallel', async () => {
    const fetcher1 = vi.fn().mockResolvedValue({ data: 'first' })
    const fetcher2 = vi.fn().mockResolvedValue({ data: 'second' })
    const fetcher3 = vi.fn().mockResolvedValue({ data: 'third' })

    const { result } = renderHook(() =>
      useCachedQueries([
        { key: 'key1', fetcher: fetcher1 },
        { key: 'key2', fetcher: fetcher2 },
        { key: 'key3', fetcher: fetcher3 },
      ])
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.results[0].data).toEqual({ data: 'first' })
    expect(result.current.results[1].data).toEqual({ data: 'second' })
    expect(result.current.results[2].data).toEqual({ data: 'third' })
    expect(fetcher1).toHaveBeenCalledTimes(1)
    expect(fetcher2).toHaveBeenCalledTimes(1)
    expect(fetcher3).toHaveBeenCalledTimes(1)
  })

  it('should handle errors in multiple queries', async () => {
    const fetcher1 = vi.fn().mockResolvedValue({ data: 'first' })
    const fetcher2 = vi.fn().mockRejectedValue(new Error('Error 2'))
    const fetcher3 = vi.fn().mockResolvedValue({ data: 'third' })

    const { result } = renderHook(() =>
      useCachedQueries([
        { key: 'key1', fetcher: fetcher1 },
        { key: 'key2', fetcher: fetcher2 },
        { key: 'key3', fetcher: fetcher3 },
      ])
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.results[0].data).toEqual({ data: 'first' })
    expect(result.current.results[1].error).toBeInstanceOf(Error)
    expect(result.current.results[2].data).toEqual({ data: 'third' })
    expect(result.current.hasError).toBe(true)
    expect(result.current.errors).toHaveLength(1)
  })

  it('should skip disabled queries', async () => {
    const fetcher1 = vi.fn().mockResolvedValue({ data: 'first' })
    const fetcher2 = vi.fn().mockResolvedValue({ data: 'second' })

    const { result } = renderHook(() =>
      useCachedQueries([
        { key: 'key1', fetcher: fetcher1 },
        { key: 'key2', fetcher: fetcher2, options: { enabled: false } },
      ])
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.results[0].data).toEqual({ data: 'first' })
    expect(result.current.results[1].data).toBe(undefined)
    expect(fetcher1).toHaveBeenCalledTimes(1)
    expect(fetcher2).not.toHaveBeenCalled()
  })

  it('should refetch all queries', async () => {
    const fetcher1 = vi
      .fn()
      .mockResolvedValueOnce({ data: 'first-1' })
      .mockResolvedValueOnce({ data: 'first-2' })
    const fetcher2 = vi
      .fn()
      .mockResolvedValueOnce({ data: 'second-1' })
      .mockResolvedValueOnce({ data: 'second-2' })

    const { result } = renderHook(() =>
      useCachedQueries([
        { key: 'key1', fetcher: fetcher1 },
        { key: 'key2', fetcher: fetcher2 },
      ])
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.refetchAll()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.results[0].data).toEqual({ data: 'first-2' })
    expect(result.current.results[1].data).toEqual({ data: 'second-2' })
    expect(fetcher1).toHaveBeenCalledTimes(2)
    expect(fetcher2).toHaveBeenCalledTimes(2)
  })
})
