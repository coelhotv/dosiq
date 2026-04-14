import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getStockData } from '../services/stockService'

/**
 * Hook para gerenciar e calcular dados de estoque conforme ADR-018.
 */
export function useStock() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    refreshing: false
  })

  const loadStock = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) setState(prev => ({ ...prev, refreshing: true }))
    else setState(prev => ({ ...prev, loading: true }))

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada')

      const result = await getStockData(user.id)
      
      if (!result.success) throw new Error(result.error)

      // Processamento dos dados para ADR-018
      const processedData = result.data.map(item => {
        const totalQuantity = item.medicine_stock_summary?.[0]?.total_quantity || 0
        
        // Cálculo do consumo diário baseado nos protocolos ativos
        // Nota: Assumindo frequência diária conforme simplificação atual (H5.5)
        const dailyConsumption = (item.protocols || []).reduce((acc, p) => {
          const intakesPerDay = (p.time_schedule || []).length || 1
          return acc + (Number(p.dosage_per_intake) * intakesPerDay)
        }, 0)

        const daysRemaining = dailyConsumption > 0 
          ? totalQuantity / dailyConsumption 
          : Infinity

        // Classificação conforme ADR-018
        let status = 'HIGH'
        let statusLabel = 'Bom'
        let color = '#3b82f6' // Blue

        if (daysRemaining < 7) {
          status = 'CRITICAL'
          statusLabel = 'Crítico'
          color = '#ef4444' // Red
        } else if (daysRemaining < 14) {
          status = 'LOW'
          statusLabel = 'Baixo'
          color = '#f59e0b' // Orange
        } else if (daysRemaining < 30) {
          status = 'NORMAL'
          statusLabel = 'Normal'
          color = '#22c55e' // Green
        }

        return {
          ...item,
          totalQuantity,
          dailyConsumption,
          daysRemaining,
          status,
          statusLabel,
          color
        }
      })

      setState({
        data: processedData,
        loading: false,
        error: null,
        refreshing: false
      })
    } catch (err) {
      console.error('[useStock] Erro:', err)
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: err.message
      }))
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
