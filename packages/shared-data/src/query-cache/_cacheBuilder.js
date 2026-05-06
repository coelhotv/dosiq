/**
 * _cacheBuilder.js — Implementação interna do QueryCache.
 *
 * Módulo privado (prefixo _) extraído de createQueryCache.js para manter
 * a função factory abaixo de 100 linhas (max-lines-per-function).
 * Não deve ser importado diretamente por outros módulos.
 * @module _cacheBuilder
 */

const GC_INTERVAL = 60_000

// --- helpers puros (sem estado) ---

function _log(logger, level, msg) {
  if (!logger) return
  const fn = logger[level] ?? logger.log
  if (fn) fn(`[QueryCache] ${msg}`)
}

function _isStale(timestamp, staleTime, customStaleTime) {
  return Date.now() - timestamp > (customStaleTime ?? staleTime)
}

function _deleteFromMaps(key, cache, accessCount, pendingRequests) {
  cache.delete(key)
  accessCount.delete(key)
  pendingRequests.delete(key)
}

// --- helpers com estado injetado ---

function _schedulePersist(state) {
  const { cache, maxEntries, persistKey, storage, logger, setJSON } = state
  if (state.persistTimer) clearTimeout(state.persistTimer)
  state.persistTimer = setTimeout(async () => {
    try {
      const entries = Array.from(cache.entries())
        .filter(([, v]) => !v.isRevalidating)
        .slice(0, maxEntries)
      await setJSON(storage, persistKey, entries)
    } catch (err) {
      _log(logger, 'warn', `Falha ao persistir cache: ${err.message}`)
    }
    state.persistTimer = null
  }, 500)
}

function _garbageCollect(state) {
  const { cache, accessCount, pendingRequests, maxEntries, staleTime, logger } = state
  const now = Date.now()
  const ttlThreshold = staleTime * 2
  let removed = 0

  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > ttlThreshold) {
      _deleteFromMaps(key, cache, accessCount, pendingRequests)
      removed++
    }
  }

  if (removed > 0) _log(logger, 'log', `GC TTL: ${removed} entradas removidas`)
  if (cache.size <= maxEntries) return

  const sorted = Array.from(accessCount.entries()).sort((a, b) => a[1] - b[1])
  const toEvict = sorted.slice(0, cache.size - maxEntries)
  toEvict.forEach(([key]) => _deleteFromMaps(key, cache, accessCount, pendingRequests))

  if (toEvict.length > 0) {
    _log(logger, 'log', `GC LRU: ${toEvict.length} entradas evictadas. Tamanho: ${cache.size}`)
    _schedulePersist(state)
  }
}

async function _revalidateStale(key, fetcher, cached, state) {
  const { cache, logger } = state
  try {
    const capturedGen = state.cacheGeneration
    const data = await fetcher()
    if (capturedGen === state.cacheGeneration) {
      cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
      state.accessCounter++
      state.accessCount.set(key, state.accessCounter)
      _garbageCollect(state)
      _schedulePersist(state)
    }
    return data
  } catch (err) {
    _log(logger, 'warn', `Revalidacao falhou: ${key} — ${err.message}`)
    cached.isRevalidating = false
    throw err
  }
}

async function _fetchAndStore(key, fetcher, state) {
  const { cache, pendingRequests, logger } = state
  try {
    const capturedGen = state.cacheGeneration
    const data = await fetcher()
    if (capturedGen === state.cacheGeneration) {
      cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
      state.accessCounter++
      state.accessCount.set(key, state.accessCounter)
      _garbageCollect(state)
      _schedulePersist(state)
    }
    return data
  } catch (err) {
    _log(logger, 'warn', `Fetch falhou: ${key} — ${err.message}`)
    throw err
  } finally {
    pendingRequests.delete(key)
  }
}

// --- API publica ---

async function _init(state) {
  if (state.initialized) return
  const { storage, persistKey, cache, logger, getJSON: _getJSON } = state
  try {
    const persisted = await _getJSON(storage, persistKey, null)
    if (Array.isArray(persisted)) {
      persisted.forEach(([key, value]) => cache.set(key, { ...value, isRevalidating: false }))
      _log(logger, 'log', `Hidracao: ${persisted.length} entradas carregadas`)
    }
  } catch (err) {
    _log(logger, 'warn', `Falha ao hidratar cache: ${err.message}`)
  }
  state.gcInterval = setInterval(() => _garbageCollect(state), GC_INTERVAL)
  state.initialized = true
}

async function _cachedQuery(key, fetcher, options, state) {
  const { dedupe = true, staleTime: customStaleTime } = options
  const { cache, pendingRequests, logger, staleTime } = state
  const cached = cache.get(key)

  if (dedupe && pendingRequests.has(key)) {
    _log(logger, 'log', `Deduplica: ${key}`)
    return pendingRequests.get(key)
  }
  if (cached && !_isStale(cached.timestamp, staleTime, customStaleTime)) {
    state.accessCounter++
    state.accessCount.set(key, state.accessCounter)
    _log(logger, 'log', `HIT (fresh): ${key}`)
    return cached.data
  }
  if (cached) {
    _log(logger, 'log', `HIT (stale): ${key} — revalidando em background`)
    const revalPromise = _revalidateStale(key, fetcher, cached, state)
    cached.isRevalidating = true
    revalPromise.catch(() => {})
    state.accessCounter++
    state.accessCount.set(key, state.accessCounter)
    return cached.data
  }
  _log(logger, 'log', `MISS: ${key}`)
  const fetchPromise = _fetchAndStore(key, fetcher, state)
  if (dedupe) pendingRequests.set(key, fetchPromise)
  return fetchPromise
}

function _invalidate(pattern, state) {
  const { cache, accessCount, pendingRequests, logger } = state
  let count = 0
  if (typeof pattern === 'string') {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) { _deleteFromMaps(key, cache, accessCount, pendingRequests); count++ }
      }
    } else if (cache.has(pattern)) {
      _deleteFromMaps(pattern, cache, accessCount, pendingRequests)
      count = 1
    }
  } else if (pattern instanceof RegExp) {
    for (const key of cache.keys()) {
      if (pattern.test(key)) { _deleteFromMaps(key, cache, accessCount, pendingRequests); count++ }
    }
  }
  if (count > 0) { _schedulePersist(state); _log(logger, 'log', `Invalidadas ${count} entradas para: ${pattern}`) }
  return count
}

function _clear(state) {
  const { cache, accessCount, pendingRequests, logger } = state
  if (state.persistTimer) { clearTimeout(state.persistTimer); state.persistTimer = null }
  state.cacheGeneration++
  const size = cache.size
  cache.clear(); accessCount.clear(); pendingRequests.clear()
  state.accessCounter = 0
  _log(logger, 'log', `Cache limpo: ${size} entradas removidas`)
}

function _getStats(state) {
  const { cache, pendingRequests, maxEntries, staleTime } = state
  const entries = Array.from(cache.entries())
  const staleCount = entries.filter(([, v]) => _isStale(v.timestamp, staleTime)).length
  return {
    size: cache.size, staleEntries: staleCount, freshEntries: cache.size - staleCount,
    pendingRequests: pendingRequests.size, maxEntries, initialized: state.initialized,
  }
}

/**
 * Constrói e retorna uma instância do QueryCache com estado encapsulado.
 * @param {Object} deps - Dependências injetadas pela factory
 * @returns {QueryCache}
 */
export function _buildCache(deps) {
  const state = {
    ...deps,
    cache: new Map(),
    pendingRequests: new Map(),
    accessCount: new Map(),
    accessCounter: 0,
    cacheGeneration: 0,
    gcInterval: null,
    persistTimer: null,
    initialized: false,
  }

  return {
    init: () => _init(state),
    cachedQuery: (key, fetcher, options = {}) => _cachedQuery(key, fetcher, options, state),
    invalidate: (pattern) => _invalidate(pattern, state),
    clear: () => _clear(state),
    prefetch(key, data) {
      state.cache.set(key, { data, timestamp: Date.now(), isRevalidating: false })
      state.accessCounter++
      state.accessCount.set(key, state.accessCounter)
      _garbageCollect(state)
      _schedulePersist(state)
    },
    getStats: () => _getStats(state),
    cancelGC() {
      if (state.gcInterval) { clearInterval(state.gcInterval); state.gcInterval = null }
    },
    restartGC() {
      if (!state.gcInterval) state.gcInterval = setInterval(() => _garbageCollect(state), GC_INTERVAL)
    },
  }
}
