/**
 * @jest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  cachedQuery, 
  invalidateCache, 
  clearCache, 
  getCacheStats,
  generateCacheKey,
  prefetchCache,
  CACHE_CONFIG 
} from '../queryCache'

describe('queryCache', () => {
  beforeEach(() => {
    clearCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('cachedQuery', () => {
    it('deve executar fetcher e cachear resultado na primeira chamada', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      const result = await cachedQuery('test-key', fetcher)
      
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ data: 'test' })
    })

    it('deve retornar cache em vez de executar fetcher na segunda chamada', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      await cachedQuery('test-key', fetcher)
      const result = await cachedQuery('test-key', fetcher)
      
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ data: 'test' })
    })

    it('deve retornar dados stale imediatamente e revalidar em background', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ data: 'old' })
        .mockResolvedValueOnce({ data: 'new' })
      
      // Primeira chamada
      await cachedQuery('stale-key', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(1)
      
      // Avança o tempo além do stale time
      vi.advanceTimersByTime(CACHE_CONFIG.STALE_TIME + 1000)
      
      // Segunda chamada deve retornar stale imediatamente
      const result = await cachedQuery('stale-key', fetcher)
      expect(result).toEqual({ data: 'old' }) // Retorna stale
      
      // Aguarda revalidação em background
      await vi.advanceTimersByTimeAsync(100)
      
      // Verifica que fetcher foi chamado novamente
      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('deve deduplicar requests em andamento', async () => {
      let resolve
      const fetcher = vi.fn().mockImplementation(() => 
        new Promise(r => { resolve = r })
      )
      
      // Inicia duas queries simultâneas
      const promise1 = cachedQuery('dedupe-key', fetcher)
      const promise2 = cachedQuery('dedupe-key', fetcher)
      
      // Resolve a promise
      resolve({ data: 'test' })
      
      const [result1, result2] = await Promise.all([promise1, promise2])
      
      // Fetcher deve ser chamado apenas uma vez
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
    })

    it('deve propagar erros do fetcher', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('Fetch failed'))
      
      await expect(cachedQuery('error-key', fetcher)).rejects.toThrow('Fetch failed')
    })
  })

  describe('generateCacheKey', () => {
    it('deve gerar chave simples sem parâmetros', () => {
      const key = generateCacheKey('medicines')
      expect(key).toBe('medicines')
    })

    it('deve gerar chave com parâmetros', () => {
      const key = generateCacheKey('medicine', { id: '123' })
      expect(key).toBe('medicine:{"id":"123"}')
    })

    it('deve gerar chave única para diferentes parâmetros', () => {
      const key1 = generateCacheKey('medicine', { id: '123' })
      const key2 = generateCacheKey('medicine', { id: '456' })
      expect(key1).not.toBe(key2)
    })
  })

  describe('invalidateCache', () => {
    it('deve invalidar cache por chave exata', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      await cachedQuery('key1', fetcher)
      await cachedQuery('key2', fetcher)
      
      expect(fetcher).toHaveBeenCalledTimes(2)
      
      // Invalida key1
      invalidateCache('key1')
      
      // Chama novamente - key1 deve refetch, key2 deve usar cache
      await cachedQuery('key1', fetcher)
      await cachedQuery('key2', fetcher)
      
      expect(fetcher).toHaveBeenCalledTimes(3) // key1 refetch
    })

    it('deve invalidar cache por prefixo', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      await cachedQuery('medicines:all', fetcher)
      await cachedQuery('medicines:123', fetcher)
      await cachedQuery('protocols:all', fetcher)
      
      invalidateCache('medicines:*')
      
      await cachedQuery('medicines:all', fetcher)
      await cachedQuery('medicines:123', fetcher)
      await cachedQuery('protocols:all', fetcher)
      
      // medicines refetch, protocols usa cache
      expect(fetcher).toHaveBeenCalledTimes(5)
    })

    it('deve retornar número de entradas invalidadas', () => {
      cachedQuery('key1', () => Promise.resolve('a'))
      cachedQuery('key2', () => Promise.resolve('b'))
      
      const count = invalidateCache('key*')
      expect(count).toBe(2)
    })
  })

  describe('prefetchCache', () => {
    it('deve preencher cache com dados', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'fetched' })
      
      prefetchCache('prefetch-key', { data: 'prefetched' })
      
      const result = await cachedQuery('prefetch-key', fetcher)
      
      expect(result).toEqual({ data: 'prefetched' })
      expect(fetcher).not.toHaveBeenCalled()
    })
  })

  describe('getCacheStats', () => {
    it('deve retornar estatísticas do cache', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      await cachedQuery('key1', fetcher)
      await cachedQuery('key2', fetcher)
      
      const stats = getCacheStats()
      
      expect(stats.size).toBe(2)
      expect(stats.freshEntries).toBe(2)
      expect(stats.staleEntries).toBe(0)
      expect(stats.maxEntries).toBe(CACHE_CONFIG.MAX_ENTRIES)
    })

    it('deve identificar entradas stale', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      await cachedQuery('key1', fetcher)
      
      vi.advanceTimersByTime(CACHE_CONFIG.STALE_TIME + 1000)
      
      const stats = getCacheStats()
      
      expect(stats.staleEntries).toBe(1)
      expect(stats.freshEntries).toBe(0)
    })
  })

  describe('garbage collection', () => {
    it('deve remover entradas antigas quando limite é excedido (LRU)', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      // Preenche o cache até o limite
      for (let i = 0; i < CACHE_CONFIG.MAX_ENTRIES; i++) {
        await cachedQuery(`key-${i}`, fetcher)
      }
      
      expect(getCacheStats().size).toBe(CACHE_CONFIG.MAX_ENTRIES)
      
      // Adiciona mais uma entrada
      await cachedQuery('new-key', fetcher)
      
      // Deve manter o limite
      expect(getCacheStats().size).toBe(CACHE_CONFIG.MAX_ENTRIES)
    })
  })

  describe('clearCache', () => {
    it('deve limpar todo o cache', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      
      await cachedQuery('key1', fetcher)
      await cachedQuery('key2', fetcher)
      
      expect(getCacheStats().size).toBe(2)
      
      clearCache()
      
      expect(getCacheStats().size).toBe(0)
    })
  })
})
