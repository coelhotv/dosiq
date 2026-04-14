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

      // 1. Processamento base e cálculo ADR-018
      const processed = result.data.map(item => {
        const totalQuantity = item.medicine_stock_summary?.[0]?.total_quantity || 0
        
        // Protocolos ativos vinculados
        const activeProtocols = (item.protocols || []).filter(p => p.active)
        
        const dailyConsumption = activeProtocols.reduce((acc, p) => {
          const intakesPerDay = (p.time_schedule || []).length || 1
          return acc + (Number(p.dosage_per_intake) * intakesPerDay)
        }, 0)

        const daysRemaining = dailyConsumption > 0 
          ? totalQuantity / dailyConsumption 
          : Infinity

        // Classificação conforme ADR-018
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

      // 2. Filtragem: Remover quem não tem estoque E não tem protocolo ativo
      const filtered = processed.filter(item => item.totalQuantity > 0 || item.hasActiveProtocol)

      // 3. Categorização e Ordenação
      const active = filtered
        .filter(item => item.hasActiveProtocol)
        .sort((a, b) => a.daysRemaining - b.daysRemaining) // Urgência primeiro

      const inactive = filtered
        .filter(item => !item.hasActiveProtocol)
        .sort((a, b) => a.name.localeCompare(b.name))

      setState({
        data: { active, inactive },
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
