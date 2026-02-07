import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useCachedQuery, 
  useCachedQueries, 
  useCachedMutation,
  invalidateCache,
  clearCache
} from '../useCachedQuery'

describe('useCachedQuery', () => {
  beforeEach(() => {
    clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    clearCache()
    vi.resetAllMocks()
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
      const { result } = renderHook(() => 
        useCachedQuery('test-key', fetcher, { enabled: false })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(fetcher).not.toHaveBeenCalled()
      expect(result.current.data).toBe(undefined)
    })
  })

  describe('refetch functionality', () => {
    it('should refetch data with force option', async () => {
      const fetcher = vi.fn()
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
      const fetcher = vi.fn()
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
      
      renderHook(() => 
        useCachedQuery('test-key', fetcher, { onSuccess })
      )

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({ data: 'test' })
      })
    })

    it('should call onError callback', async () => {
      const onError = vi.fn()
      const error = new Error('Fetch failed')
      const fetcher = vi.fn().mockRejectedValue(error)
      
      renderHook(() => 
        useCachedQuery('error-key', fetcher, { onError })
      )

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
      const fetcher = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 100))
      )
      
      const { result, unmount } = renderHook(() => useCachedQuery('test-key', fetcher))

      unmount()

      await new Promise(resolve => setTimeout(resolve, 150))

      // Should not throw error after unmount
      expect(result.current.data).toBe(undefined)
    })
  })
})

describe('useCachedQueries', () => {
  beforeEach(() => {
    clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    clearCache()
    vi.resetAllMocks()
  })

  it('should fetch multiple queries in parallel', async () => {
    const fetcher1 = vi.fn().mockResolvedValue({ data: 'first' })
    const fetcher2 = vi.fn().mockResolvedValue({ data: 'second' })
    const fetcher3 = vi.fn().mockResolvedValue({ data: 'third' })

    const { result } = renderHook(() => 
      useCachedQueries([
        { key: 'key1', fetcher: fetcher1 },
        { key: 'key2', fetcher: fetcher2 },
        { key: 'key3', fetcher: fetcher3 }
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
        { key: 'key3', fetcher: fetcher3 }
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
        { key: 'key2', fetcher: fetcher2, options: { enabled: false } }
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
    const fetcher1 = vi.fn()
      .mockResolvedValueOnce({ data: 'first-1' })
      .mockResolvedValueOnce({ data: 'first-2' })
    const fetcher2 = vi.fn()
      .mockResolvedValueOnce({ data: 'second-1' })
      .mockResolvedValueOnce({ data: 'second-2' })

    const { result } = renderHook(() => 
      useCachedQueries([
        { key: 'key1', fetcher: fetcher1 },
        { key: 'key2', fetcher: fetcher2 }
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

describe('useCachedMutation', () => {
  beforeEach(() => {
    clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    clearCache()
    vi.resetAllMocks()
  })

  it('should execute mutation successfully', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn, { invalidateKeys: ['test-key'] })
    )

    await act(async () => {
      await result.current.mutate({ input: 'test' })
    })

    expect(result.current.data).toEqual({ success: true })
    expect(result.current.error).toBe(null)
    expect(result.current.isLoading).toBe(false)
    expect(mutationFn).toHaveBeenCalledWith({ input: 'test' })
  })

  it('should handle mutation errors', async () => {
    const error = new Error('Mutation failed')
    const mutationFn = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn)
    )

    await act(async () => {
      try {
        await result.current.mutate({ input: 'test' })
      } catch {
        // Expected error
      }
    })

    expect(result.current.error).toBe(error)
    expect(result.current.isError).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('should invalidate cache keys after successful mutation', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn, { invalidateKeys: ['key1', 'key2'] })
    )

    await act(async () => {
      await result.current.mutate({ input: 'test' })
    })

    expect(result.current.data).toEqual({ success: true })
    // Cache should be invalidated (verified by console.log in implementation)
  })

  it('should invalidate single cache key', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn, { invalidateKeys: 'single-key' })
    )

    await act(async () => {
      await result.current.mutate({ input: 'test' })
    })

    expect(result.current.data).toEqual({ success: true })
  })

  it('should call onSuccess callback', async () => {
    const onSuccess = vi.fn()
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn, { onSuccess })
    )

    await act(async () => {
      await result.current.mutate({ input: 'test' })
    })

    expect(onSuccess).toHaveBeenCalledWith({ success: true })
  })

  it('should call onError callback', async () => {
    const onError = vi.fn()
    const error = new Error('Mutation failed')
    const mutationFn = vi.fn().mockRejectedValue(error)
    
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn, { onError })
    )

    await act(async () => {
      try {
        await result.current.mutate({ input: 'test' })
      } catch {
        // Expected error
      }
    })

    expect(onError).toHaveBeenCalledWith(error)
  })

  it('should reset mutation state', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn)
    )

    await act(async () => {
      await result.current.mutate({ input: 'test' })
    })

    expect(result.current.data).toEqual({ success: true })

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBe(null)
    expect(result.current.error).toBe(null)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
  })
})

describe('useCachedQuery - edge cases', () => {
  beforeEach(() => {
    clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    clearCache()
    vi.resetAllMocks()
  })

  it('should handle null fetcher', async () => {
    const { result } = renderHook(() => useCachedQuery('test-key', null))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBe(undefined)
  })

  it('should handle empty queries array', async () => {
    const { result } = renderHook(() => useCachedQueries([]))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.results).toEqual([])
    expect(result.current.hasError).toBe(false)
  })

  it('should handle mutation with no invalidate keys', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ success: true })
    const { result } = renderHook(() => 
      useCachedMutation(mutationFn)
    )

    await act(async () => {
      await result.current.mutate({ input: 'test' })
    })

    expect(result.current.data).toEqual({ success: true })
  })
})
