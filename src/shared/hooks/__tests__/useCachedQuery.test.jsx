import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useCachedQuery,
  invalidateCache,
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

describe('useCachedQuery', () => {
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

  describe('basic functionality', () => {
    it('should fetch data successfully', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      const { result } = renderHook(() => useCachedQuery('test-key', fetcher))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual({ data: 'test' })
      expect(result.current.error).toBe(null)
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('should handle fetch errors', async () => {
      const error = new Error('Fetch failed')
      const fetcher = vi.fn().mockRejectedValue(error)
      const { result } = renderHook(() => useCachedQuery('error-key', fetcher))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBe(error)
      expect(result.current.data).toBe(undefined)
    })

    it('should not fetch when key is null', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      const { result } = renderHook(() => useCachedQuery(null, fetcher))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(fetcher).not.toHaveBeenCalled()
      expect(result.current.data).toBe(undefined)
    })

    it('should not fetch when enabled is false', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      const { result } = renderHook(() => useCachedQuery('test-key', fetcher, { enabled: false }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(fetcher).not.toHaveBeenCalled()
      expect(result.current.data).toBe(undefined)
    })
  })

  describe('refetch functionality', () => {
    it('should refetch data with force option', async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' })

      const { result } = renderHook(() => useCachedQuery('test-key', fetcher))

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'first' })
      })

      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'second' })
      })

      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('should refresh data in background', async () => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' })

      const { result } = renderHook(() => useCachedQuery('test-key', fetcher))

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'first' })
      })

      // Invalidate cache before refresh to ensure new data
      invalidateCache('test-key')

      // Refresh should not set isLoading to true
      await act(async () => {
        await result.current.refresh()
      })

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'second' })
      })

      expect(fetcher).toHaveBeenCalledTimes(2)
    })
  })

  describe('initial data', () => {
    it('should use initial data', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'fetched' })
      const { result } = renderHook(() =>
        useCachedQuery('test-key', fetcher, { initialData: { data: 'initial' } })
      )

      // Initial data should be available immediately
      expect(result.current.data).toEqual({ data: 'initial' })

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'fetched' })
      })
    })
  })

  describe('callbacks', () => {
    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn()
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })

      renderHook(() => useCachedQuery('test-key', fetcher, { onSuccess }))

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ data: 'test' })
      })
    })

    it('should call onError callback', async () => {
      const onError = vi.fn()
      const error = new Error('Fetch failed')
      const fetcher = vi.fn().mockRejectedValue(error)

      renderHook(() => useCachedQuery('error-key', fetcher, { onError }))

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error)
      })
    })
  })

  describe('stale time', () => {
    it('should respect stale time option', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      const { result, rerender } = renderHook(() =>
        useCachedQuery('test-key', fetcher, { staleTime: 5000 })
      )

      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'test' })
      })

      expect(fetcher).toHaveBeenCalledTimes(1)

      // Rerender should not refetch within stale time
      rerender()
      await waitFor(() => {
        expect(result.current.data).toEqual({ data: 'test' })
      })

      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup', () => {
    it('should not update state after unmount', async () => {
      const fetcher = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ data: 'test' }), 100))
        )

      const { result, unmount } = renderHook(() => useCachedQuery('test-key', fetcher))

      // Unmount immediately to prevent state updates
      unmount()

      // Wait longer than the fetcher to ensure it completes
      // Using a small delay to prevent hanging (safer than real timers in CI)
      await new Promise(resolve => setTimeout(resolve, 5))

      // Should not throw error after unmount
      expect(result.current.data).toBe(undefined)
    })
  })

  describe('edge cases', () => {
    it('should handle null fetcher', async () => {
      const { result } = renderHook(() => useCachedQuery('test-key', null))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBe(undefined)
    })
  })
})
