import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getStockData } from '../services/stockService'

const STOCK_CACHE_KEY = '@meus-remedios/stock-snapshot'

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
      
      if (!result.success) throw new Error(result.error)

      // 1. Processamento base e cálculo ADR-018
      const processed = result.data.map(item => {
        const totalQuantity = item.medicine_stock_summary?.[0]?.total_quantity || 0
        const activeProtocols = (item.protocols || []).filter(p => p.active)
        
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
        }

        return {
          ...item,
          totalQuantity,
          dailyConsumption,
          daysRemaining,
          status,
          statusLabel,
          color,
          hasActiveProtocol: activeProtocols.length > 0
        }
      })

      const filtered = processed.filter(item => item.totalQuantity > 0 || item.hasActiveProtocol)
      const active = filtered.filter(item => item.hasActiveProtocol).sort((a, b) => a.daysRemaining - b.daysRemaining)
      const inactive = filtered.filter(item => !item.hasActiveProtocol).sort((a, b) => a.name.localeCompare(b.name))

      const newData = { active, inactive }
      const snapshot = {
        data: newData,
        capturedAt: new Date().toISOString()
      }

      await AsyncStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(snapshot))

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
          const capturedAt = new Date(parsed.capturedAt)
          const now = new Date()
          const diffHours = (now - capturedAt) / (1000 * 60 * 60)

          if (diffHours < 24) {
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

  return {
    ...state,
    refresh: () => loadStock(true)
  }
}
