/**
 * useNotificationLog — Hook Nativo para histórico de notificações (Mobile)
 *
 * Segue o padrão de resiliência offline com snapshot em AsyncStorage.
 *
 * @module useNotificationLog
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import { getTodayLocal } from '@dosiq/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNotificationLogRepository } from '@dosiq/shared-data'
import { supabase } from '../../platform/supabase/nativeSupabaseClient'

/**
 * Gera chave de cache dinâmica por usuário para evitar vazamento de dados (Security Fix)
 * @param {string} userId 
 * @returns {string}
 */
const getCacheKey = (userId) => `@dosiq/notif-log-snapshot:${userId}`

// Repositório singleton para a plataforma mobile
const repo = createNotificationLogRepository({ supabase })

/**
 * Hook para buscar logs de notificações com resiliência offline.
 *
 * @param {Object} options
 * @param {string} options.userId - ID do usuário (UUID)
 * @param {number} [options.limit=20] - Itens por página
 * @param {number} [options.offset=0] - Offset de paginação
 * @returns {Object} { data, loading, error, stale, refresh }
 */
export function useNotificationLog(options = {}) {
  const { userId, limit = 20, offset = 0 } = options

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)

  // Ref para evitar atualizações em componente desmontado
  const isMounted = useRef(true)

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (__DEV__) console.log('[useNotificationLog] Fetching notifications...')

      const logs = await repo.listByUserId(userId, { limit, offset })

      const cacheKey = getCacheKey(userId)
      const snapshot = {
        logs,
        capturedAt: new Date().toISOString(),
        localDay: getTodayLocal(), // R-114 compat
      }

      // Persiste para uso offline
      await AsyncStorage.setItem(cacheKey, JSON.stringify(snapshot))

      if (isMounted.current) {
        setData(logs)
        setStale(false)
        setError(null)
      }
    } catch (err) {
      if (__DEV__) console.warn('[useNotificationLog] Fetch failed, checking cache:', err.message)

      try {
        const cacheKey = getCacheKey(userId)
        const cached = await AsyncStorage.getItem(cacheKey)
        if (cached && isMounted.current) {
          const { logs } = JSON.parse(cached)
          setData(logs)
          setStale(true)
          setError(null)
        } else if (isMounted.current) {
          setError(err.message || 'Erro ao carregar notificações.')
        }
      } catch (cacheErr) {
        if (isMounted.current) setError('Erro de conexão e cache ausente.')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [userId, limit, offset])

  useEffect(() => {
    isMounted.current = true
    load()
    return () => {
      isMounted.current = false
    }
  }, [load])

  // Lógica de Refresh de Meia-Noite e AppState (R-184)
  // Garante que logs fiquem atualizados quando o dia muda ou app volta do background
  useEffect(() => {
    let midnightTimer

    const scheduleMidnightRefresh = () => {
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setDate(nextMidnight.getDate() + 1)
      nextMidnight.setHours(0, 0, 0, 0)
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime()
      
      clearTimeout(midnightTimer)
      midnightTimer = setTimeout(() => {
        if (__DEV__) console.log('[useNotificationLog] Meia-noite: Refreshing...')
        load()
        scheduleMidnightRefresh()
      }, msUntilMidnight + 1000)
    }

    scheduleMidnightRefresh()

    const handleStateChange = (nextState) => {
      if (nextState === 'active') {
        // Forçar um refresh leve ao voltar, opcionalmente checar se o dia mudou
        if (__DEV__) console.log('[useNotificationLog] App active: Refreshing...')
        load()
      }
    }

    const subscription = AppState.addEventListener('change', handleStateChange)

    return () => {
      subscription.remove()
      clearTimeout(midnightTimer)
    }
  }, [load])

  return {
    data,
    loading,
    error,
    stale,
    refresh: load,
  }
}
