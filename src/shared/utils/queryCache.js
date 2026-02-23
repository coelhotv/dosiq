/**
 * Query Cache - Implementação SWR (Stale-While-Revalidate)
 *
 * Características:
 * - Cache com stale time de 30s
 * - Revalidação em background
 * - Deduplicação de requests
 * - Limite de 50 entradas (LRU eviction)
 * - Invalidação de cache por chave ou pattern
 *
 * @module queryCache
 */

const CACHE_CONFIG = {
  STALE_TIME: 30 * 1000, // 30 segundos
  MAX_ENTRIES: 200, // Limite elevado para suportar volumetria do Dashboard
  GC_INTERVAL: 60 * 1000, // Garbage collection a cada 60s
  PERSIST_KEY: 'meus_remedios_query_cache',
}

// Estrutura do cache: Map<key, { data, timestamp, isRevalidating }>
const cache = new Map()

/**
 * Persiste o cache no LocalStorage (debounced 500ms para evitar writes síncronos repetidos)
 */
function persistCache() {
  // Skip persistence in test environment to save memory
  if (typeof window === 'undefined' || !window.localStorage || process.env.NODE_ENV === 'test') {
    return
  }

  // Debounce: cancela timer anterior e agenda novo
  if (persistTimer) clearTimeout(persistTimer)

  persistTimer = setTimeout(() => {
    try {
      const entries = Array.from(cache.entries())
        .filter(([, value]) => !value.isRevalidating) // Não persiste estados transitórios
        .slice(0, CACHE_CONFIG.MAX_ENTRIES)

      localStorage.setItem(CACHE_CONFIG.PERSIST_KEY, JSON.stringify(entries))
    } catch (error) {
      console.warn('[QueryCache] Erro ao persistir cache:', error)
    }
    persistTimer = null
  }, 500)
}

/**
 * Hidrata o cache a partir do LocalStorage
 */
function hydrateCache() {
  // Skip hydration in test environment
  if (typeof window === 'undefined' || !window.localStorage || process.env.NODE_ENV === 'test') {
    return
  }

  try {
    const persisted = localStorage.getItem(CACHE_CONFIG.PERSIST_KEY)
    if (persisted) {
      const entries = JSON.parse(persisted)
      entries.forEach(([key, value]) => {
        cache.set(key, { ...value, isRevalidating: false })
      })
      console.log(`[QueryCache] Hidratadas ${cache.size} entradas do LocalStorage`)
    }
  } catch (error) {
    console.warn('[QueryCache] Erro ao hidratar cache:', error)
  }
}

// Inicializa hidratação
if (typeof window !== 'undefined' && window.localStorage) {
  hydrateCache()
}

// Deduplicação de requests em andamento: Map<key, Promise>
const pendingRequests = new Map()

// Contador de acessos para LRU
const accessCount = new Map()
let accessCounter = 0

// Cache generation counter (invalidates in-flight writes on clearCache)
let cacheGeneration = 0

// Debounced persistence timer
let persistTimer = null

/**
 * Gera uma chave de cache única baseada nos parâmetros
 * @param {string} baseKey - Chave base (nome do recurso)
 * @param {*} params - Parâmetros adicionais
 * @returns {string} Chave única
 */
export function generateCacheKey(baseKey, params = null) {
  if (!params) return baseKey
  const paramsHash = JSON.stringify(params)
  return `${baseKey}:${paramsHash}`
}

/**
 * Executa garbage collection no cache removindo entradas antigas
 * se o limite for excedido (estratégia LRU)
 */
function garbageCollect() {
  const now = Date.now()
  let removedByTTL = 0

  // Fase 1: Remove entradas expiradas por TTL (2x STALE_TIME = 60s)
  const ttlThreshold = CACHE_CONFIG.STALE_TIME * 2
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > ttlThreshold) {
      cache.delete(key)
      accessCount.delete(key)
      pendingRequests.delete(key)
      removedByTTL++
    }
  }

  if (removedByTTL > 0) {
    console.log(`[QueryCache] GC TTL: removidas ${removedByTTL} entradas expiradas`)
  }

  // Fase 2: LRU eviction se ainda exceder MAX_ENTRIES
  if (cache.size <= CACHE_CONFIG.MAX_ENTRIES) return

  const sortedEntries = Array.from(accessCount.entries()).sort((a, b) => a[1] - b[1])
  const entriesToRemove = sortedEntries.slice(0, cache.size - CACHE_CONFIG.MAX_ENTRIES)

  entriesToRemove.forEach(([key]) => {
    cache.delete(key)
    accessCount.delete(key)
    pendingRequests.delete(key)
  })

  console.log(
    `[QueryCache] GC LRU: removidas ${entriesToRemove.length} entradas. Cache size: ${cache.size}`
  )
  persistCache()
}

/**
 * Atualiza o contador de acesso para LRU
 * @param {string} key - Chave do cache
 */
function updateAccess(key) {
  accessCounter++
  accessCount.set(key, accessCounter)
}

/**
 * Verifica se os dados estão stale (expirados)
 * @param {number} timestamp - Timestamp da entrada
 * @returns {boolean} True se estiver stale
 */
function isStale(timestamp) {
  return Date.now() - timestamp > CACHE_CONFIG.STALE_TIME
}

/**
 * Executa uma query com cache SWR
 *
 * Fluxo:
 * 1. Se tem cache válido (não stale): retorna imediatamente
 * 2. Se tem cache stale: retorna stale + revalida em background
 * 3. Se não tem cache: executa fetcher e armazena
 *
 * @param {string} key - Chave única do cache
 * @param {Function} fetcher - Função que retorna Promise com os dados
 * @param {Object} options - Opções adicionais
 * @param {number} options.staleTime - Tempo de stale em ms (padrão: 30000)
 * @param {boolean} options.dedupe - Se deve deduplicar requests (padrão: true)
 * @returns {Promise<*>} Dados do cache ou do fetcher
 */
export async function cachedQuery(key, fetcher, options = {}) {
  const { dedupe = true } = options
  const cached = cache.get(key)

  // Deduplicação: se já tem um request em andamento para esta chave, reutiliza
  if (dedupe && pendingRequests.has(key)) {
    console.log(`[QueryCache] Deduplicando request: ${key}`)
    return pendingRequests.get(key)
  }

  // Se tem cache válido (não stale), retorna imediatamente
  if (cached && !isStale(cached.timestamp)) {
    updateAccess(key)
    console.log(`[QueryCache] Cache HIT (fresh): ${key}`)
    return cached.data
  }

  // Se tem cache stale, retorna stale + revalida em background
  if (cached) {
    console.log(`[QueryCache] Cache HIT (stale): ${key}, revalidando...`)

    // Revalidação em background (não espera)
    // Captura a geração atual antes do await para evitar escrever após clearCache()
    const capturedGen = cacheGeneration
    const revalidationPromise = (async () => {
      try {
        const data = await fetcher()
        // Só escreve se a geração não mudou (cache não foi limpo)
        if (capturedGen === cacheGeneration) {
          cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
          updateAccess(key)
          garbageCollect()
          persistCache()
          console.log(`[QueryCache] Revalidação OK: ${key}`)
        }
        return data
      } catch (error) {
        console.error(`[QueryCache] Revalidação falhou: ${key}`, error)
        // Marca como não revalidando em caso de erro
        cached.isRevalidating = false
        throw error
      }
    })()

    // Não bloqueia o retorno dos dados stale
    cached.isRevalidating = true

    // Executa revalidação em background mas não aguarda
    revalidationPromise.catch(() => {}) // Swallow errors for background revalidation

    updateAccess(key)
    return cached.data
  }

  // Cache MISS: executa fetcher
  console.log(`[QueryCache] Cache MISS: ${key}`)

  // Captura a geração atual antes do await para evitar escrever após clearCache()
  const capturedGen = cacheGeneration
  const fetchPromise = (async () => {
    try {
      const data = await fetcher()
      // Só escreve se a geração não mudou (cache não foi limpo)
      if (capturedGen === cacheGeneration) {
        cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
        updateAccess(key)
        garbageCollect()
        persistCache()
      }
      return data
    } catch (error) {
      console.error(`[QueryCache] Fetch falhou: ${key}`, error)
      throw error
    } finally {
      pendingRequests.delete(key)
    }
  })()

  if (dedupe) {
    pendingRequests.set(key, fetchPromise)
  }

  return fetchPromise
}

/**
 * Invalida entradas do cache
 *
 * @param {string|RegExp} pattern - Chave exata ou regex para matching
 * @returns {number} Número de entradas invalidadas
 */
export function invalidateCache(pattern) {
  let invalidatedCount = 0

  if (typeof pattern === 'string') {
    // Invalidação exata ou por prefixo (se terminar com *)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
          cache.delete(key)
          accessCount.delete(key)
          pendingRequests.delete(key)
          invalidatedCount++
        }
      }
    } else {
      // Invalidação exata
      if (cache.has(pattern)) {
        cache.delete(pattern)
        accessCount.delete(pattern)
        pendingRequests.delete(pattern)
        invalidatedCount = 1
      }
    }
  } else if (pattern instanceof RegExp) {
    // Invalidação por regex
    for (const key of cache.keys()) {
      if (pattern.test(key)) {
        cache.delete(key)
        accessCount.delete(key)
        pendingRequests.delete(key)
        invalidatedCount++
      }
    }
  }

  if (invalidatedCount > 0) {
    persistCache()
  }

  console.log(`[QueryCache] Invalidadas ${invalidatedCount} entradas para pattern: ${pattern}`)
  return invalidatedCount
}

/**
 * Preenche o cache com dados (útil para SSR ou pré-carregamento)
 *
 * @param {string} key - Chave do cache
 * @param {*} data - Dados a serem armazenados
 */
export function prefetchCache(key, data) {
  cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
  updateAccess(key)
  garbageCollect()
  persistCache()
  console.log(`[QueryCache] Prefetch: ${key}`)
}

/**
 * Retorna estatísticas do cache (para debug)
 * @returns {Object} Estatísticas
 */
export function getCacheStats() {
  const entries = Array.from(cache.entries())
  const staleCount = entries.filter(([, v]) => isStale(v.timestamp)).length

  return {
    size: cache.size,
    staleEntries: staleCount,
    freshEntries: cache.size - staleCount,
    pendingRequests: pendingRequests.size,
    maxEntries: CACHE_CONFIG.MAX_ENTRIES,
    entries: entries.map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      isStale: isStale(value.timestamp),
      isRevalidating: value.isRevalidating,
    })),
  }
}

/**
 * Limpa todo o cache
 */
export function clearCache() {
  // Cancela qualquer persistência pendente
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }

  // Incrementa geração para invalidar qualquer escrita in-flight (background revalidation)
  cacheGeneration++

  const size = cache.size
  cache.clear()
  accessCount.clear()
  pendingRequests.clear()
  accessCounter = 0  // Reseta counter para LRU funcionar corretamente em runs longos

  if (typeof window !== 'undefined' && window.localStorage && process.env.NODE_ENV !== 'test') {
    try {
      localStorage.removeItem(CACHE_CONFIG.PERSIST_KEY)
    } catch (error) {
      // Silently ignore errors
    }
  }
  console.log(`[QueryCache] Cache limpo. ${size} entradas removidas.`)
}

// Garbage collection periódico
let gcInterval = setInterval(garbageCollect, CACHE_CONFIG.GC_INTERVAL)

/**
 * Cancela o intervalo de garbage collection (para testes)
 * @internal
 */
export function cancelGarbageCollection() {
  if (gcInterval) {
    clearInterval(gcInterval)
    gcInterval = null
  }
}

/**
 * Reinicia o intervalo de garbage collection (para testes)
 * @internal
 */
export function restartGarbageCollection() {
  if (!gcInterval) {
    gcInterval = setInterval(garbageCollect, CACHE_CONFIG.GC_INTERVAL)
  }
}

/**
 * Força garbage collection imediatamente
 * @internal
 */
export function forceGarbageCollection() {
  garbageCollect()
}

// Exporta configuração para testes
export { CACHE_CONFIG }
