import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTodayLocal, isProtocolActiveOnDate, getNow, parseISO } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getStockData } from '../services/stockService'

const STOCK_CACHE_KEY = '@dosiq/stock-snapshot'

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

  // Ref para verificação de snapshot (R-184)
  const dataRef = useRef(null)

  const loadStock = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) setState(prev => ({ ...prev, refreshing: true, error: null }))
    else setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      let user = currentSession?.user
      if (sessionError || !user) {
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !verifiedUser) throw new Error('Sessão expirada')
        user = verifiedUser
      }

      const result = await getStockData(user.id)
      const today = getTodayLocal()
      
      if (!result.success) throw new Error(result.error)

      // 1. Processamento base e cálculo ADR-018
      const processed = result.data.map(item => {
        const totalQuantity = item.medicine_stock_summary?.[0]?.total_quantity || 0
        
        // Filtro de validade temporal (Wave v0.1.5)
        const activeProtocols = (item.protocols || []).filter(p => 
          p.active && isProtocolActiveOnDate(p, today)
        )
        
        const dailyConsumption = activeProtocols.reduce((acc, p) => {
          const intakesPerDay = (p.time_schedule || []).length || 1
          return acc + (Number(p.dosage_per_intake) * intakesPerDay)
        }, 0)

        const daysRemaining = dailyConsumption > 0 
          ? totalQuantity / dailyConsumption 
          : Infinity

        let status = 'HIGH'
        let statusLabel = 'Bom'
        let color = '#3b82f6'

        if (daysRemaining < 7) {
          status = 'CRITICAL'
          statusLabel = 'Crítico'
          color = '#ef4444'
        } else if (daysRemaining < 14) {
          status = 'LOW'
          statusLabel = 'Baixo'
          color = '#f59e0b'
        } else if (daysRemaining < 30) {
          status = 'NORMAL'
          statusLabel = 'Normal'
          color = '#22c55e'
        } else {
          status = 'HIGH'
          statusLabel = 'Bom'
          color = '#3b82f6'
        }

        return {
          ...item,
          totalQuantity,
          dailyConsumption,
          daysRemaining,
          status,
          statusLabel,
          color,
          hasActiveProtocol: activeProtocols.length > 0,
          // Mantemos os protocolos para garantir que o snapshot contenha as datas para re-processamento se necessário
          activeProtocols 
        }
      })

      // Na fase Read-Only Mobile, filtramos RIGOROSAMENTE para mostrar apenas o que tem protocolo hoje
      const active = processed
        .filter(item => item.hasActiveProtocol)
        .sort((a, b) => a.daysRemaining - b.daysRemaining)

      // Nota: Não mostramos a lista de inativos no Read-Only mobile por enquanto (reduzir ruído)
      const newData = { 
        active, 
        inactive: [],
        localDay: today // R-114 fix: salvar dia local explícito
      }
      const snapshot = {
        data: newData,
        capturedAt: getNow().toISOString(),
        rawData: result.data // Salvamos o raw para resiliência de cache total se o dia mudar
      }

      await AsyncStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(snapshot))

      dataRef.current = newData
      setState({
        data: newData,
        loading: false,
        error: null,
        stale: false,
        refreshing: false
      })
    } catch (err) {
      if (__DEV__) console.warn('[useStock] Fetch failed, checking cache:', err.message)
      
      try {
        const cached = await AsyncStorage.getItem(STOCK_CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          const capturedAt = parseISO(parsed.capturedAt)
          const now = getNow()
          const diffHours = (now.getTime() - capturedAt.getTime()) / (1000 * 60 * 60)

          if (diffHours < 24) {
            dataRef.current = parsed.data
            setState({
              data: parsed.data,
              loading: false,
              error: null,
              stale: true,
              refreshing: false
            })
          } else {
            throw new Error('Cache expirado')
          }
        } else {
          throw err
        }
      } catch (cacheErr) {
        setState(prev => ({
          ...prev,
          loading: false,
          refreshing: false,
          error: err.message
        }))
      }
    }
  }, [])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  // Lógica de Refresh de Meia-Noite e AppState (R-184)
  useEffect(() => {
    let midnightTimer

    const scheduleMidnightRefresh = () => {
      const now = getNow()
      const nextMidnight = new Date(now.getTime())
      nextMidnight.setDate(nextMidnight.getDate() + 1)
      nextMidnight.setHours(0, 0, 0, 0)
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime()
      
      clearTimeout(midnightTimer)
      midnightTimer = setTimeout(() => {
        if (__DEV__) console.log('[useStock] Meia-noite detectada: Refreshing...')
        loadStock()
        scheduleMidnightRefresh()
      }, msUntilMidnight + 1000)
    }

    scheduleMidnightRefresh()

    const handleStateChange = (nextState) => {
      if (nextState === 'active') {
        const today = getTodayLocal()
        if (dataRef.current?.localDay && dataRef.current.localDay !== today) {
          if (__DEV__) console.log('[useStock] Dia alterado via background: Refreshing...')
          loadStock()
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleStateChange)
    return () => {
      subscription.remove()
      clearTimeout(midnightTimer)
    }
  }, [loadStock])

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
