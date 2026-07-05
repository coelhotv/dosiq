/**
 * useCachedQuery - Hook React para uso do cache SWR
 *
 * Fornece uma interface React-friendly para o queryCache com:
 * - Estados de loading/error/data
 * - Revalidação automática
 * - Refetch manual
 * - Integração com ciclo de vida do componente
 *
 * @module useCachedQuery
 */

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react'
import { webQueryCache } from '@shared/platform/query-cache/webQueryCache'
import { debugLog } from '@shared/utils/logger'

type Fetcher<T> = () => Promise<T>

// Aliases locais para a engine — mantem chamadas internas compactas
const cachedQuery = <T,>(key: string, fetcher: Fetcher<T>, opts: { staleTime?: number }) =>
  webQueryCache.cachedQuery(key, fetcher, opts) as Promise<T>
const invalidateCache = (pattern: string) => webQueryCache.invalidate(pattern)

export interface UseCachedQueryOptions<T> {
  enabled?: boolean
  staleTime?: number
  initialData?: T | null
  onSuccess?: (result: T) => void
  onError?: (err: unknown) => void
}

export interface UseCachedQueryResult<T> {
  data: T | null | undefined
  isLoading: boolean
  isFetching: boolean
  error: unknown
  refetch: () => Promise<T | undefined>
  refresh: () => Promise<T | undefined>
}

/**
 * Hook para executar queries com cache SWR
 */
export function useCachedQuery<T>(
  key: string | null | undefined,
  fetcher: Fetcher<T> | null | undefined,
  options: UseCachedQueryOptions<T> = {}
): UseCachedQueryResult<T> {
  const { enabled = true, staleTime, initialData, onSuccess, onError } = options

  const [data, setData] = useState<T | null | undefined>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // Refs para controle de cancelamento e duplicação
  const isMounted = useRef(true)
  const fetchCount = useRef(0)

  const handleFetchSuccess = useCallback((result: T, fetchId: number) => {
    if (isMounted.current && fetchId === fetchCount.current) {
      setData(result)
      setIsLoading(false)
      setIsFetching(false)
      onSuccess?.(result)
    }
  }, [onSuccess])

  const handleFetchError = useCallback((err: unknown, fetchId: number) => {
    if (isMounted.current && fetchId === fetchCount.current) {
      setError(err)
      setIsLoading(false)
      setIsFetching(false)
      onError?.(err)
    }
  }, [onError])

  const executeQuery = useCallback(
    async (options: { force?: boolean; background?: boolean } = {}) => {
      const { force = false, background = false } = options
      if (!key || !enabled || !fetcher) return

      const currentFetch = ++fetchCount.current

      try {
        if (!background) setIsLoading(true)
        setIsFetching(true)
        setError(null)

        if (force) invalidateCache(key)

        const result = await cachedQuery(key, fetcher, { staleTime })
        handleFetchSuccess(result, currentFetch)
        return result
      } catch (err) {
        handleFetchError(err, currentFetch)
        throw err
      }
    },
    [key, fetcher, enabled, staleTime, handleFetchSuccess, handleFetchError]
  )

  // Fetch inicial
  useEffect(() => {
    isMounted.current = true

    if (enabled && key) {
      // Catch rejection to prevent unhandled promise warning
      // (error is already handled in executeQuery catch block and set in state)
      startTransition(() => {
        executeQuery().catch(() => {})
      })
    }

    return () => {
      isMounted.current = false
    }
  }, [key, enabled, executeQuery])

  // Refetch manual
  const refetch = useCallback(async () => {
    return executeQuery({ force: true })
  }, [executeQuery])

  // Refetch em background (silencioso)
  const refresh = useCallback(async () => {
    return executeQuery({ background: true })
  }, [executeQuery])

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    refresh,
  }
}

export interface CachedQueryDescriptor<T> {
  key: string | null | undefined
  fetcher: Fetcher<T> | null | undefined
  options?: { enabled?: boolean; staleTime?: number }
}

interface QueryResult<T> {
  data: T | undefined
  isLoading: boolean
  isFetching: boolean
  error: unknown
}

interface SettledQuery<T> {
  index: number
  data: T | undefined
  error: unknown
}

export interface UseCachedQueriesResult<T> {
  results: QueryResult<T>[]
  isLoading: boolean
  isFetching: boolean
  hasError: boolean
  errors: unknown[]
  refetchAll: () => Promise<void>
}

/**
 * Utilitário para executar múltiplas queries em paralelo
 * Extraído para evitar duplicação entre fetchAll e refetchAll
 */
async function executeParallelQueries<T>(
  queries: CachedQueryDescriptor<T>[]
): Promise<SettledQuery<T>[]> {
  const promises = queries.map(async (query, index) => {
    const { key, fetcher, options = {} } = query
    const { enabled = true, staleTime } = options

    if (!enabled || !key || !fetcher) {
      return { index, data: undefined, error: null }
    }

    try {
      const data = await cachedQuery(key, fetcher, { staleTime })
      return { index, data, error: null }
    } catch (error) {
      return { index, data: undefined, error }
    }
  })

  return Promise.all(promises)
}

/**
 * Hook para múltiplas queries em paralelo com cache SWR
 */
export function useCachedQueries<T>(queries: CachedQueryDescriptor<T>[]): UseCachedQueriesResult<T> {
  const [results, setResults] = useState<QueryResult<T>[]>(() =>
    queries.map(() => ({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    }))
  )

  // Chave estável derivada das query keys (não muda com rerenders desnecessários)
  const queriesKey = queries.map((q) => q.key ?? 'null').join('|')

  // Ref para acessar queries atualizadas dentro do effect sem re-disparar o effect
  // (evita render loop causado por [queries] como dependência)
  const queriesRef = useRef(queries)

  const isMounted = useRef(true)

  const isLoading = useMemo(() => results.some((r) => r.isLoading), [results])
  const isFetching = useMemo(() => results.some((r) => r.isFetching), [results])
  const hasError = useMemo(() => results.some((r) => r.error), [results])
  const errors = useMemo(() => results.map((r) => r.error).filter(Boolean), [results])

  // Note: Using [queriesKey] instead of [queries] to prevent infinite render loops.
  // We manually update queriesRef.current inside effect to access fresh query values.
  // This is intentional — queriesKey is a stable string derived from query keys.

  const updateResults = useCallback((settled: SettledQuery<T>[]) => {
    if (isMounted.current) {
      setResults((prev) => {
        const next = [...prev]
        settled.forEach(({ index, data, error }) => {
          next[index] = {
            data,
            error,
            isLoading: false,
            isFetching: false,
          }
        })
        return next
      })
    }
  }, [])

  useEffect(() => {
    isMounted.current = true
    queriesRef.current = queries

    const fetchAll = async () => {
      setResults((prev) => prev.map((r) => ({ ...r, isLoading: true })))
      const settled = await executeParallelQueries(queriesRef.current)
      updateResults(settled)
    }

    startTransition(() => {
      fetchAll()
    })

    return () => {
      isMounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queriesKey, updateResults])

  const refetchAll = useCallback(async () => {
    const currentQueries = queriesRef.current
    currentQueries.forEach((query) => {
      const { key } = query
      if (key) invalidateCache(key)
    })

    setResults((prev) => prev.map((r) => ({ ...r, isLoading: true })))
    const settled = await executeParallelQueries(currentQueries)
    updateResults(settled)
  }, [updateResults])

  return {
    results,
    isLoading,
    isFetching,
    hasError,
    errors,
    refetchAll,
  }
}

export interface UseCachedMutationOptions<T> {
  invalidateKeys?: string | (string | null | undefined)[]
  onSuccess?: (result: T) => void
  onError?: (err: unknown) => void
}

export interface UseCachedMutationResult<T, V> {
  mutate: (variables: V) => Promise<T>
  reset: () => void
  data: T | null
  isLoading: boolean
  error: unknown
  isError: boolean
}

/**
 * Hook para mutações que invalidam cache após sucesso
 */
export function useCachedMutation<T, V = unknown>(
  mutationFn: (variables: V) => Promise<T>,
  options: UseCachedMutationOptions<T> = {}
): UseCachedMutationResult<T, V> {
  const { invalidateKeys = [], onSuccess, onError } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [data, setData] = useState<T | null>(null)

  const mutate = useCallback(
    async (variables: V) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await mutationFn(variables)
        setData(result)

        // Invalida as chaves especificadas
        const keysToInvalidate = Array.isArray(invalidateKeys) ? invalidateKeys : [invalidateKeys]

        keysToInvalidate.forEach((key) => {
          if (key) {
            invalidateCache(key)
            debugLog('useCachedMutation', `Cache invalidado: ${key}`)
          }
        })

        onSuccess?.(result)
        return result
      } catch (err) {
        setError(err)
        onError?.(err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [mutationFn, invalidateKeys, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    mutate,
    reset,
    data,
    isLoading,
    error,
    isError: !!error,
  }
}

// Re-exporta funções úteis do query cache (via pacote centralizado — evita duplicação)
export { generateCacheKey } from '@dosiq/shared-data'

export { invalidateCache }

export function prefetchCache<T>(key: string, data: T): void {
  webQueryCache.prefetch(key, data)
}

export function getCacheStats() {
  return webQueryCache.getStats()
}

export function clearCache() {
  webQueryCache.clear()
}

export function cancelGarbageCollection() {
  webQueryCache.cancelGC()
}

export function restartGarbageCollection() {
  webQueryCache.restartGC()
}
