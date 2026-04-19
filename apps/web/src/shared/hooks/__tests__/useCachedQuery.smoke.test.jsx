import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'

describe('Smoke: useCachedQuery', () => {
  it('fetches data on mount and returns loading state', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'smoke-test' })

    const { result } = renderHook(() => useCachedQuery('smoke-hook-key', fetcher))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual({ data: 'smoke-test' })
    expect(result.current.error).toBeNull()
  })
})
