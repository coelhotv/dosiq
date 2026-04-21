/**
 * createQueryCache — Engine de cache SWR compartilhada (platform-agnostic)
 *
 * Design:
 * - Factory function: sem singleton global, sem inicializacao em import
 * - Storage injetado: funciona com web localStorage, AsyncStorage, memoryStorage
 * - Logger injetado: sem dependencia de console/debugLog especifico da plataforma
 * - React-free: a engine nao importa React — hooks ficam na plataforma
 * - Async-first: persiste/hidrata via storage adapter async (contratos H3.1)
 *
 * Regra: NUNCA chamar `init()` fora do bootstrap da plataforma.
 *
 * @module createQueryCache
 */

import { setJSON, getJSON } from '@dosiq/storage'

/**
 * Cria uma instancia de query cache com dependencias injetadas.
 *
 * @param {Object} options
 * @param {import('@dosiq/storage').StorageAdapter} options.storage - Adapter de storage async
 * @param {Object} [options.logger] - Logger opcional com metodo log/warn/error
 * @param {number} [options.staleTime=30000] - Tempo (ms) antes de um entry ficar stale
 * @param {number} [options.maxEntries=200] - Maximo de entradas no cache (LRU eviction)
 * @param {string} [options.persistKey='dosiq_query_cache'] - Chave de persistencia
 * @returns {QueryCache} Instancia do cache
 */
export function createQueryCache({
  storage,
  logger = null,
  staleTime = 30_000,
  maxEntries = 200,
  persistKey = 'dosiq_query_cache',
} = {}) {
  if (!storage) throw new Error('createQueryCache: storage adapter is required')

  // --- estado privado da instancia ---
  /** @type {Map<string, {data: *, timestamp: number, isRevalidating: boolean}>} */
  const cache = new Map()
  /** @type {Map<string, Promise>} */
  const pendingRequests = new Map()
  /** @type {Map<string, number>} */
  const accessCount = new Map()
  let accessCounter = 0
  let cacheGeneration = 0
  let gcInterval = null
  let persistTimer = null
  let initialized = false

  const GC_INTERVAL = 60_000

  // --- helpers privados ---

  function log(level, msg) {
    if (!logger) return
    const fn = logger[level] ?? logger.log
    if (fn) fn(`[QueryCache] ${msg}`)
  }

  function isStale(timestamp, customStaleTime) {
    return Date.now() - timestamp > (customStaleTime ?? staleTime)
  }

  function updateAccess(key) {
    accessCounter++
    accessCount.set(key, accessCounter)
  }

  /**
   * Persiste o cache no storage adapter (debounced 500ms).
   * Nunca bloqueia — falhas sao logadas e ignoradas.
   */
  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(async () => {
      try {
        const entries = Array.from(cache.entries())
          .filter(([, v]) => !v.isRevalidating)
          .slice(0, maxEntries)
        await setJSON(storage, persistKey, entries)
      } catch (err) {
        log('warn', `Falha ao persistir cache: ${err.message}`)
      }
      persistTimer = null
    }, 500)
  }

  function garbageCollect() {
    const now = Date.now()
    const ttlThreshold = staleTime * 2
    let removed = 0

    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > ttlThreshold) {
        cache.delete(key)
        accessCount.delete(key)
        pendingRequests.delete(key)
        removed++
      }
    }

    if (removed > 0) log('log', `GC TTL: ${removed} entradas removidas`)

    if (cache.size <= maxEntries) return

    const sorted = Array.from(accessCount.entries()).sort((a, b) => a[1] - b[1])
    const toEvict = sorted.slice(0, cache.size - maxEntries)
    toEvict.forEach(([key]) => {
      cache.delete(key)
      accessCount.delete(key)
      pendingRequests.delete(key)
    })

    if (toEvict.length > 0) {
      log('log', `GC LRU: ${toEvict.length} entradas evictadas. Tamanho: ${cache.size}`)
      schedulePersist()
    }
  }

  // --- API publica ---

  /**
   * Inicializa o cache: hidrata do storage e inicia GC.
   * DEVE ser chamado explicitamente no bootstrap da plataforma.
   * Nao e chamado automaticamente no import.
   *
   * @returns {Promise<void>}
   */
  async function init() {
    if (initialized) return

    try {
      const persisted = await getJSON(storage, persistKey, null)
      if (Array.isArray(persisted)) {
        persisted.forEach(([key, value]) => {
          cache.set(key, { ...value, isRevalidating: false })
        })
        log('log', `Hidracao: ${persisted.length} entradas carregadas`)
      }
    } catch (err) {
      log('warn', `Falha ao hidratar cache: ${err.message}`)
    }

    gcInterval = setInterval(garbageCollect, GC_INTERVAL)
    initialized = true
  }

  /**
   * Executa uma query com semantica SWR (Stale-While-Revalidate):
   * 1. Cache valido (fresh) → retorna imediatamente
   * 2. Cache stale → retorna stale + revalida em background
   * 3. Cache MISS → executa fetcher e armazena
   *
   * @param {string} key - Chave unica
   * @param {Function} fetcher - Funcao que retorna Promise com os dados
   * @param {Object} [options]
   * @param {number} [options.staleTime] - Override de staleTime para esta query
   * @param {boolean} [options.dedupe=true] - Deduplica requests em voo
   * @returns {Promise<*>}
   */
  async function cachedQuery(key, fetcher, options = {}) {
    const { dedupe = true, staleTime: customStaleTime } = options
    const cached = cache.get(key)

    if (dedupe && pendingRequests.has(key)) {
      log('log', `Deduplica: ${key}`)
      return pendingRequests.get(key)
    }

    if (cached && !isStale(cached.timestamp, customStaleTime)) {
      updateAccess(key)
      log('log', `HIT (fresh): ${key}`)
      return cached.data
    }

    if (cached) {
      log('log', `HIT (stale): ${key} — revalidando em background`)
      const capturedGen = cacheGeneration
      const revalPromise = (async () => {
        try {
          const data = await fetcher()
          if (capturedGen === cacheGeneration) {
            cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
            updateAccess(key)
            garbageCollect()
            schedulePersist()
          }
          return data
        } catch (err) {
          log('warn', `Revalidacao falhou: ${key} — ${err.message}`)
          cached.isRevalidating = false
          throw err
        }
      })()
      cached.isRevalidating = true
      revalPromise.catch(() => {})
      updateAccess(key)
      return cached.data
    }

    log('log', `MISS: ${key}`)
    const capturedGen = cacheGeneration
    const fetchPromise = (async () => {
      try {
        const data = await fetcher()
        if (capturedGen === cacheGeneration) {
          cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
          updateAccess(key)
          garbageCollect()
          schedulePersist()
        }
        return data
      } catch (err) {
        log('warn', `Fetch falhou: ${key} — ${err.message}`)
        throw err
      } finally {
        pendingRequests.delete(key)
      }
    })()

    if (dedupe) pendingRequests.set(key, fetchPromise)
    return fetchPromise
  }

  /**
   * Invalida entradas do cache por chave exata, prefixo (*) ou regex.
   *
   * @param {string|RegExp} pattern
   * @returns {number} Numero de entradas invalidadas
   */
  function invalidate(pattern) {
    let count = 0

    if (typeof pattern === 'string') {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1)
        for (const key of cache.keys()) {
          if (key.startsWith(prefix)) {
            cache.delete(key)
            accessCount.delete(key)
            pendingRequests.delete(key)
            count++
          }
        }
      } else if (cache.has(pattern)) {
        cache.delete(pattern)
        accessCount.delete(pattern)
        pendingRequests.delete(pattern)
        count = 1
      }
    } else if (pattern instanceof RegExp) {
      for (const key of cache.keys()) {
        if (pattern.test(key)) {
          cache.delete(key)
          accessCount.delete(key)
          pendingRequests.delete(key)
          count++
        }
      }
    }

    if (count > 0) {
      schedulePersist()
      log('log', `Invalidadas ${count} entradas para: ${pattern}`)
    }

    return count
  }

  /**
   * Limpa todo o cache e cancela persist pendente.
   * Incrementa cacheGeneration para invalidar fetches em voo.
   */
  function clear() {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    cacheGeneration++
    const size = cache.size
    cache.clear()
    accessCount.clear()
    pendingRequests.clear()
    accessCounter = 0
    log('log', `Cache limpo: ${size} entradas removidas`)
  }

  /**
   * Preenche o cache com dados (util para pre-carregamento ou testes).
   *
   * @param {string} key
   * @param {*} data
   */
  function prefetch(key, data) {
    cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
    updateAccess(key)
    garbageCollect()
    schedulePersist()
  }

  /**
   * Retorna estatisticas do cache (debug).
   * @returns {Object}
   */
  function getStats() {
    const entries = Array.from(cache.entries())
    const staleCount = entries.filter(([, v]) => isStale(v.timestamp)).length
    return {
      size: cache.size,
      staleEntries: staleCount,
      freshEntries: cache.size - staleCount,
      pendingRequests: pendingRequests.size,
      maxEntries,
      initialized,
    }
  }

  /**
   * Cancela GC interval (para testes).
   * @internal
   */
  function cancelGC() {
    if (gcInterval) {
      clearInterval(gcInterval)
      gcInterval = null
    }
  }

  /**
   * Reinicia GC interval (para testes).
   * @internal
   */
  function restartGC() {
    if (!gcInterval) {
      gcInterval = setInterval(garbageCollect, GC_INTERVAL)
    }
  }

  return {
    init,
    cachedQuery,
    invalidate,
    clear,
    prefetch,
    getStats,
    // internals para testes
    cancelGC,
    restartGC,
  }
}
