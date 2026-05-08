import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTodayLocal, getNow, parseISO, addDays, isProtocolActiveOnDate } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getStockData } from '../services/stockService'
import { debugLog } from '@shared/utils/debugLog'
import { transformStockData, filterActiveStockItems } from './_stockDataTransformer'

const STOCK_CACHE_KEY = '@dosiq/stock-snapshot'

async function _resolveUser() {
  const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
  let user = currentSession?.user
  if (sessionError || !user) {
    const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
    if (userError || !verifiedUser) throw new Error('Sessão expirada')
    user = verifiedUser
  }
  return user
}

async function _fetchAndPersistStock(userId, setState, dataRef) {
  const result = await getStockData(userId)
  const today = getTodayLocal()
  if (!result.success) throw new Error(result.error)
  const active = filterActiveStockItems(transformStockData(result.data))
  const newData = { active, inactive: [], localDay: today }
  const snapshot = { data: newData, capturedAt: getNow().toISOString(), rawData: result.data }
  await AsyncStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(snapshot))
  dataRef.current = newData
  setState({ data: newData, loading: false, error: null, stale: false, refreshing: false })
}

async function _tryLoadCache(err, setState, dataRef) {
  const cached = await AsyncStorage.getItem(STOCK_CACHE_KEY)
  if (!cached) throw err
  const parsed = JSON.parse(cached)
  const diffHours = (getNow().getTime() - parseISO(parsed.capturedAt).getTime()) / (1000 * 60 * 60)
  if (diffHours >= 24) throw new Error('Cache expirado')
  dataRef.current = parsed.data
  setState({ data: parsed.data, loading: false, error: null, stale: true, refreshing: false })
}

function _setupMidnightAndAppState(loadStock, dataRef) {
  let midnightTimer
  const scheduleMidnightRefresh = () => {
    const now = getNow()
    const nextMidnight = addDays(now, 1)
    nextMidnight.setHours(0, 0, 0, 0)
    clearTimeout(midnightTimer)
    midnightTimer = setTimeout(() => {
      debugLog('useStock', 'Meia-noite detectada: Refreshing...')
      loadStock()
      scheduleMidnightRefresh()
    }, nextMidnight.getTime() - now.getTime() + 1000)
  }
  scheduleMidnightRefresh()
  const handleStateChange = (nextState) => {
    if (nextState === 'active') {
      const today = getTodayLocal()
      if (dataRef.current?.localDay && dataRef.current.localDay !== today) {
        debugLog('useStock', 'Dia alterado via background: Refreshing...')
        loadStock()
      }
    }
  }
  const subscription = AppState.addEventListener('change', handleStateChange)
  return () => { subscription.remove(); clearTimeout(midnightTimer) }
}

/**
 * Hook para gerenciar e calcular dados de estoque conforme ADR-018.
 */
export function useStock() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    stale: false,
    refreshing: false
  })

  const dataRef = useRef(null)

  const loadStock = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) setState(prev => ({ ...prev, refreshing: true, error: null }))
    else setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const user = await _resolveUser()
      await _fetchAndPersistStock(user.id, setState, dataRef)
    } catch (err) {
      if (__DEV__) console.warn('[useStock] Fetch failed, checking cache:', err.message)
      try {
        await _tryLoadCache(err, setState, dataRef)
      } catch {
        setState(prev => ({ ...prev, loading: false, refreshing: false, error: err.message }))
      }
    }
  }, [])

  useEffect(() => { loadStock() }, [loadStock])

  useEffect(() => _setupMidnightAndAppState(loadStock, dataRef), [loadStock])

  // Resilience layer (Rule R-175): Double-check validity on the active list
  // Isso protege contra o caso do cache ter sido gerado às 23:59 de ontem e carregado às 00:01 de hoje.
  const refinedData = useMemo(() => {
    if (!state.data?.active) return state.data
    const today = getTodayLocal()
    
    const refinedActive = state.data.active.filter(item => {
      // Se o item já foi processado e tem activeProtocols salvos:
      if (item.activeProtocols) {
        return item.activeProtocols.some(p => isProtocolActiveOnDate(p, today))
      }
      // Fallback para protocols originais
      return (item.protocols || []).some(p => p.active && isProtocolActiveOnDate(p, today))
    })

    return { 
      ...state.data, 
      active: refinedActive 
    }
  }, [state.data])

  const result = useMemo(() => ({
    ...state,
    data: refinedData,
    refresh: () => loadStock(true)
  }), [state, refinedData, loadStock])

  return result
}
