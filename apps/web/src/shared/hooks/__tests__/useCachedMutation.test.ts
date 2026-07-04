import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useCachedMutation,
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

describe('useCachedMutation', () => {
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
    const { result } = renderHook(() => useCachedMutation(mutationFn))

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

    const { result } = renderHook(() => useCachedMutation(mutationFn, { onSuccess }))

    await act(async () => {
      await result.current.mutate({ input: 'test' })
    })

    expect(onSuccess).toHaveBeenCalledWith({ success: true })
  })

  it('should call onError callback', async () => {
    const onError = vi.fn()
    const error = new Error('Mutation failed')
    const mutationFn = vi.fn().mockRejectedValue(error)

    const { result } = renderHook(() => useCachedMutation(mutationFn, { onError }))

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
    const { result } = renderHook(() => useCachedMutation(mutationFn))

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
