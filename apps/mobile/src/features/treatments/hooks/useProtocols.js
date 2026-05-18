// useProtocols.js — listagem + detalhe de tratamentos (Fase 2).
// Padrão: { data, loading, error, stale, refresh }
//
// Cache: AsyncStorage snapshot (R-184 — fallback offline curto, TTL 24h).
// Invalidação: useMutation invalidateKeys: ['@dosiq/protocols-snapshot'].

import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getNow, parseISO } from '@dosiq/core'
import { protocolService } from '../services/protocolService'
import { debugLog } from '@shared/utils/debugLog'

const PROTOCOLS_CACHE_KEY = '@dosiq/protocols-snapshot'
const CACHE_TTL_HOURS = 24
const MS_PER_HOUR = 1000 * 60 * 60

export function useProtocols() {
  // States
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)

  // Handlers
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await protocolService.getAll()
      const snapshot = { data: list, capturedAt: getNow().toISOString() }
      await AsyncStorage.setItem(PROTOCOLS_CACHE_KEY, JSON.stringify(snapshot))
      setData(list)
      setStale(false)
    } catch (err) {
      if (__DEV__) debugLog('useProtocols', 'fetch failed:', err.message)
      try {
        const cached = await AsyncStorage.getItem(PROTOCOLS_CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          const capturedAt = parseISO(parsed.capturedAt)
          const diffHours = (getNow() - capturedAt) / MS_PER_HOUR
          if (diffHours < CACHE_TTL_HOURS) {
            setData(parsed.data)
            setStale(true)
            setError(null)
            return
          }
        }
        throw err
      } catch {
        setError(err.message ?? 'Erro ao carregar tratamentos.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Effects
  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [load])

  // Memos
  return useMemo(
    () => ({ data, loading, error, stale, refresh: load }),
    [data, loading, error, stale, load]
  )
}

export function useProtocol(id) {
  // States
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Handlers
  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const item = await protocolService.getById(id)
      setData(item)
    } catch (err) {
      if (__DEV__) debugLog('useProtocol', 'fetch failed:', err.message)
      setError(err.message ?? 'Erro ao carregar tratamento.')
    } finally {
      setLoading(false)
    }
  }, [id])

  // Effects
  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [load])

  // Memos
  return useMemo(
    () => ({ data, loading, error, refresh: load }),
    [data, loading, error, load]
  )
}
