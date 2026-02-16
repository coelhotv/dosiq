import { describe, it, expect, vi } from 'vitest'
import { cachedQuery, invalidateCache } from '../queryCache'

describe('Smoke: Query Cache', () => {
  it('caches and returns data without refetching', async () => {
    invalidateCache() // Limpa cache
    const fetcher = vi.fn().mockResolvedValue({ data: 'test' })

    await cachedQuery('smoke-key', fetcher)
    await cachedQuery('smoke-key', fetcher)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
