import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTodayLocal, getNow, parseISO, addDays, isProtocolInPeriod } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { stockService } from '../services/stockService'
import { debugLog } from '@shared/utils/debugLog'
import { transformStockData, splitStockItems } from './_stockDataTransformer'

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

async function _fetchAndPersistStock(setState, dataRef) {
  // PO-9 §0.7: lista meds com protocolo ativo OU saldo positivo (corrige bug de
  // estoque órfão invisível). Split em active (com previsão) + inactive (só-estoque).
  // userId é resolvido internamente pela factory (G2) — não passamos mais aqui.
  const rawData = await stockService.getMedicinesWithStockOrActiveProtocol()
  const today = getTodayLocal()
  const { active, inactive } = splitStockItems(transformStockData(rawData))
  const newData = { active, inactive, localDay: today }
  const snapshot = { data: newData, capturedAt: getNow().toISOString(), rawData }
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
  const lastFetchedRef = useRef(0)

  const loadStock = useCallback(async (isRefreshing = false) => {
    const now = Date.now()
    const isWithinThrottle = now - lastFetchedRef.current < 10000
    if (!isRefreshing && isWithinThrottle && dataRef.current) {
      debugLog('useStock', 'Throttled focus/mount refresh: skip network fetch, using memory.')
      setState(prev => ({ ...prev, loading: false, refreshing: false }))
      return
    }

    if (isRefreshing) setState(prev => ({ ...prev, refreshing: true, error: null }))
    else setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      // Guard: garante sessão antes de buscar (lança "Sessão expirada" se deslogado).
      await _resolveUser()
      await _fetchAndPersistStock(setState, dataRef)
      lastFetchedRef.current = Date.now()
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

  // Resilience layer (Rule R-175): re-valida atividade no dia atual.
  // Protege contra cache gerado às 23:59 e carregado às 00:01 (dia virou).
  // PO-9: re-split active/inactive a partir da união, mantendo só-estoque visível.
  const refinedData = useMemo(() => {
    if (!state.data?.active && !state.data?.inactive) return state.data
    const today = getTodayLocal()

    // Period-only (active flag + janela), não strict frequency-aware — senão
    // semanal/dias_alternados/quando_necessario caem em "sem tratamento ativo".
    // Nome reflete período (não "dispara hoje"). Obsolescência na virada do dia
    // já coberta por _setupMidnightAndAppState (R-175) que dispara loadStock.
    const isInActivePeriod = (item) => {
      if (item.activeProtocols) {
        return item.activeProtocols.some(p => isProtocolInPeriod(p, today))
      }
      return (item.protocols || []).some(p => p.active && isProtocolInPeriod(p, today))
    }

    const union = [...(state.data.active || []), ...(state.data.inactive || [])]
    const refinedActive = union.filter(isInActivePeriod)
    // totalQuantity > 0: seção inativa só lista saldo positivo (PO-9); item sem
    // tratamento ativo E sem saldo não aparece. 0 = sem estoque, correto excluir.
    const refinedInactive = union.filter(
      item => !isInActivePeriod(item) && (item.totalQuantity ?? 0) > 0,
    )

    return {
      ...state.data,
      active: refinedActive,
      inactive: refinedInactive,
    }
  }, [state.data])

  // refresh estável (useCallback) — arrow inline no useMemo recriava a função a
  // cada setState, causando loop em consumidores com useFocusEffect([refresh]).
  const refresh = useCallback(() => loadStock(true), [loadStock])

  const result = useMemo(() => ({
    ...state,
    data: refinedData,
    refresh,
  }), [state, refinedData, refresh])

  return result
}
