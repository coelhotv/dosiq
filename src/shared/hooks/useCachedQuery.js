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

import { useState, useEffect, useCallback, useRef } from 'react'
import { cachedQuery, invalidateCache } from '../lib/queryCache'

/**
 * Hook para executar queries com cache SWR
 * 
 * @param {string} key - Chave única da query (ou null para desabilitar)
 * @param {Function} fetcher - Função que retorna Promise com os dados
 * @param {Object} options - Opções do hook
 * @param {boolean} options.enabled - Se a query está habilitada (padrão: true)
 * @param {number} options.staleTime - Tempo de stale em ms
 * @param {*} options.initialData - Dados iniciais para SSR/hidratação
 * @param {Function} options.onSuccess - Callback quando dados são carregados
 * @param {Function} options.onError - Callback quando ocorre erro
 * @returns {Object} Estado e controles da query
 */
export function useCachedQuery(key, fetcher, options = {}) {
  const {
    enabled = true,
    staleTime,
    initialData,
    onSuccess,
    onError
  } = options

  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState(null)
  
  // Refs para controle de cancelamento e duplicação
  const isMounted = useRef(true)
  const fetchCount = useRef(0)

  // Função principal de fetch
  const executeQuery = useCallback(async (options = {}) => {
    const { force = false, background = false } = options
    
    if (!key || !enabled || !fetcher) return

    const currentFetch = ++fetchCount.current

    try {
      if (!background) {
        setIsLoading(true)
      }
      setIsFetching(true)
      setError(null)

      // Se force=true, invalida o cache primeiro
      if (force) {
        invalidateCache(key)
      }

      const result = await cachedQuery(key, fetcher, { staleTime })

      // Só atualiza se for a fetch mais recente e componente montado
      if (isMounted.current && currentFetch === fetchCount.current) {
        setData(result)
        setIsLoading(false)
        setIsFetching(false)
        onSuccess?.(result)
      }

      return result
    } catch (err) {
      if (isMounted.current && currentFetch === fetchCount.current) {
        setError(err)
        setIsLoading(false)
        setIsFetching(false)
        onError?.(err)
      }
      throw err
    }
  }, [key, fetcher, enabled, staleTime, onSuccess, onError])

  // Fetch inicial
  useEffect(() => {
    isMounted.current = true
    
    if (enabled && key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      executeQuery()
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
    refresh
  }
}

/**
 * Hook para múltiplas queries em paralelo com cache SWR
 * 
 * @param {Array} queries - Array de { key, fetcher, options }
 * @returns {Object} Estado combinado das queries
 */
export function useCachedQueries(queries) {
  const [results, setResults] = useState(() => 
    queries.map(() => ({
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null
    }))
  )

  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    const fetchAll = async () => {
      // Marca todos como loading
      setResults(prev => prev.map(r => ({ ...r, isLoading: true })))

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

      const settled = await Promise.all(promises)

      if (isMounted.current) {
        setResults(prev => {
          const next = [...prev]
          settled.forEach(({ index, data, error }) => {
            next[index] = {
              data,
              error,
              isLoading: false,
              isFetching: false
            }
          })
          return next
        })
      }
    }

    fetchAll()

    return () => {
      isMounted.current = false
    }
  }, [queries])

  // Estados combinados
  const isLoading = results.some(r => r.isLoading)
  const isFetching = results.some(r => r.isFetching)
  const hasError = results.some(r => r.error)
  const errors = results.map(r => r.error).filter(Boolean)

  // Refetch todas as queries
  const refetchAll = useCallback(async () => {
    queries.forEach((query) => {
      const { key } = query
      if (key) invalidateCache(key)
    })

    // Recarrega tudo
    setResults(prev => prev.map(r => ({ ...r, isLoading: true })))

    const promises = queries.map(async (query, index) => {
      const { key, fetcher, options = {} } = query
      const { staleTime } = options

      try {
        const data = await cachedQuery(key, fetcher, { staleTime })
        return { index, data, error: null }
      } catch (error) {
        return { index, data: undefined, error }
      }
    })

    const settled = await Promise.all(promises)

    if (isMounted.current) {
      setResults(prev => {
        const next = [...prev]
        settled.forEach(({ index, data, error }) => {
          next[index] = {
            data,
            error,
            isLoading: false,
            isFetching: false
          }
        })
        return next
      })
    }
  }, [queries])

  return {
    results,
    isLoading,
    isFetching,
    hasError,
    errors,
    refetchAll
  }
}

/**
 * Hook para mutações que invalidam cache após sucesso
 * 
 * @param {Function} mutationFn - Função de mutação
 * @param {Object} options - Opções
 * @param {string|Array} options.invalidateKeys - Chaves a invalidar após sucesso
 * @param {Function} options.onSuccess - Callback de sucesso
 * @param {Function} options.onError - Callback de erro
 * @returns {Object} Estado e função de mutação
 */
export function useCachedMutation(mutationFn, options = {}) {
  const { invalidateKeys = [], onSuccess, onError } = options

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const mutate = useCallback(async (variables) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await mutationFn(variables)
      setData(result)

      // Invalida as chaves especificadas
      const keysToInvalidate = Array.isArray(invalidateKeys) 
        ? invalidateKeys 
        : [invalidateKeys]
      
      keysToInvalidate.forEach(key => {
        if (key) {
          invalidateCache(key)
          console.log(`[useCachedMutation] Cache invalidado: ${key}`)
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
  }, [mutationFn, invalidateKeys, onSuccess, onError])

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
    isError: !!error
  }
}

// Re-exporta funções úteis do queryCache
export { invalidateCache, generateCacheKey, prefetchCache, getCacheStats, clearCache } from '../lib/queryCache'
