import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useCachedQueries, invalidateCache } from '@shared/hooks/useCachedQuery'
import { CACHE_KEYS } from '@dosiq/shared-data'
import { onAuthStateChange } from '@shared/utils/supabase'
import {
  calculateAdherenceStats,
  getNextDoseTime,
  getNextDoseWindowEnd,
  isInToleranceWindow,
  calculateDailyIntake,
  calculateDaysRemaining,
  isDoseInToleranceWindow,
  isProtocolActiveOnDate,
} from '@utils/adherenceLogic'
import { formatLocalDate } from '@utils/dateUtils'
import { medicineService } from '@medications/services/medicineService'
import { protocolService } from '@protocols/services/protocolService'
import { logService } from '@shared/services/api/logService'

const DashboardContext = createContext(null)

/**
 * useDashboardContext - Orquestrador de dados do Health Command Center
 *
 * Centraliza as queries de medicamentos, protocolos e logs para
 * garantir consistência de dados e "custo zero" de queries extras.
 */
export function DashboardProvider({ children }) {
  const thirtyDaysAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString()
  }, [])

  const queries = useMemo(
    () => [
      {
        key: CACHE_KEYS.MEDICINES,
        fetcher: () => medicineService.getAll(),
      },
      {
        key: CACHE_KEYS.PROTOCOLS_ACTIVE,
        fetcher: () => protocolService.getActive(),
      },
      {
        key: 'logs:last30d',
        fetcher: async () => {
          // Slim select: apenas id, taken_at, quantity_taken, protocol_id, medicine_id, status
          // Sem relações completas — consumidores usam medicineMap/protocolMap separados
          // Reduz payload de ~315KB para ~60KB (~80% redução)
          const result = await logService.getByDateRangeSlim(
            thirtyDaysAgo.split('T')[0],
            new Date().toISOString().split('T')[0],
            1000
          )
          return result.data
        },
      },
    ],
    [thirtyDaysAgo]
  )

  const { results, isLoading, isFetching, hasError, refetchAll } = useCachedQueries(queries)

  // Assina eventos de autenticação — invalida cache imediatamente no SIGNED_IN/SIGNED_OUT
  useEffect(() => {
    const {
      data: { subscription },
    } = onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        invalidateCache(CACHE_KEYS.MEDICINES)
        invalidateCache(CACHE_KEYS.PROTOCOLS_ACTIVE)
        invalidateCache('logs:last30d')
        refetchAll({ force: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [refetchAll])

  const [medicinesResult, protocolsResult, logsResult] = results

  const rawStats = useMemo(() => {
    if (!protocolsResult.data || !logsResult.data) {
      return { score: 0, taken: 0, takenAnytime: 0, expected: 0, currentStreak: 0 }
    }
    return calculateAdherenceStats(logsResult.data, protocolsResult.data, 30)
  }, [protocolsResult.data, logsResult.data])

  // Cálculo de sumário de estoque em memória para "Custo Zero"
  const stockSummary = useMemo(() => {
    const meds = medicinesResult.data || []
    const protocols = protocolsResult.data || []

    // 1. Identificar quais medicamentos possuem protocolos ativos
    const activeMedicineIds = new Set(protocols.filter((p) => p.active).map((p) => p.medicine_id))

    // 2. Filtrar e agregar estoque apenas para medicamentos com protocolos ativos
    return meds
      .filter((m) => activeMedicineIds.has(m.id))
      .map((medicine) => {
        // medicine.stock já vem do medicineService.getAll() via query: '*, stock(*)'
        // Filtramos apenas entradas com quantidade positiva e consolidamos
        const activeStockEntries = (medicine.stock || []).filter((s) => s.quantity > 0)
        const totalQuantity = activeStockEntries.reduce((sum, s) => sum + s.quantity, 0)

        const dailyIntake = calculateDailyIntake(medicine.id, protocols)
        const daysRemaining = calculateDaysRemaining(totalQuantity, dailyIntake)

        // Um medicamento é considerado com estoque baixo se tiver consumo e durar menos de 7 dias
        // ou se o estoque total consolidado for menor ou igual ao limite definido no medicamento (se houver)
        const threshold = medicine.min_stock_threshold || 0

        // Priorização Rígida de Status
        const isZero = totalQuantity === 0
        const isLow =
          !isZero &&
          (dailyIntake > 0
            ? daysRemaining <= 7 || totalQuantity <= threshold
            : totalQuantity <= threshold && totalQuantity > 0)

        return {
          medicine,
          total: totalQuantity,
          daysRemaining,
          isZero,
          isLow,
          dailyIntake,
        }
      })
  }, [medicinesResult.data, protocolsResult.data])

  // Health Score Unificado (Onda 2.5)
  const stats = useMemo(() => {
    const adherenceWeight = 0.6
    const punctualityWeight = 0.2
    const stockWeight = 0.2

    const adherenceRate = rawStats.expected > 0 ? rawStats.takenAnytime / rawStats.expected : 1
    const punctualityRate = rawStats.expected > 0 ? rawStats.taken / rawStats.expected : 1

    const totalMeds = stockSummary.length
    const healthyStockMeds = stockSummary.filter((s) => !s.isLow && !s.isZero).length
    const stockRate = totalMeds > 0 ? healthyStockMeds / totalMeds : 1

    const adherenceScore = Math.round(adherenceRate * 100 * adherenceWeight)
    const punctualityScore = Math.round(punctualityRate * 100 * punctualityWeight)
    const stockScore = Math.round(stockRate * 100 * stockWeight)

    const totalScore = Math.min(adherenceScore + punctualityScore + stockScore, 100)

    return {
      ...rawStats,
      score: totalScore, // Sobrescreve o score simples pelo ponderado
      rates: {
        adherence: adherenceRate,
        punctuality: punctualityRate,
        stock: stockRate,
      },
    }
  }, [rawStats, stockSummary])

  const protocolsWithNextDose = useMemo(() => {
    const protocols = protocolsResult.data || []
    return protocols.map((p) => {
      const nextDose = getNextDoseTime(p)
      return {
        ...p,
        next_dose: nextDose,
        next_dose_window_end: getNextDoseWindowEnd(nextDose),
        is_in_tolerance_window: isInToleranceWindow(nextDose),
      }
    })
  }, [protocolsResult.data])

  // Cálculo client-side de dailyAdherence (últimos 7 dias)
  // Elimina chamada a adherenceService.getDailyAdherence() e suas 2 queries internas
  // (protocols + medicine_logs) — dados já estão disponíveis no context
  const dailyAdherence = useMemo(() => {
    const protocols = protocolsResult.data
    const logs = logsResult.data
    if (!protocols || !logs) return []

    const now = new Date()
    const days = 7

    // Agrupar logs por dia (formato local YYYY-MM-DD)
    const logsByDay = new Map()
    logs.forEach((log) => {
      const dayKey = formatLocalDate(new Date(log.taken_at))
      logsByDay.set(dayKey, (logsByDay.get(dayKey) || 0) + 1)
    })

    // Gerar array de 7 dias
    const dailyData = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = formatLocalDate(date)

      // Calcular doses esperadas (filtra protocolos ativos nesta data)
      const dayExpected = protocols.reduce((total, protocol) => {
        if (!isProtocolActiveOnDate(protocol, dateKey)) return total
        const timesPerDay = protocol.time_schedule?.length || 1
        return total + timesPerDay
      }, 0)

      const taken = logsByDay.get(dateKey) || 0
      const adherence = dayExpected > 0 ? Math.round((taken / dayExpected) * 100) : 0

      dailyData.push({
        date: dateKey,
        taken,
        expected: Math.round(dayExpected),
        adherence: Math.min(adherence, 100),
      })
    }

    return dailyData
  }, [protocolsResult.data, logsResult.data])

  const value = useMemo(
    () => ({
      medicines: medicinesResult.data || [],
      protocols: protocolsWithNextDose,
      logs: logsResult.data || [],
      stockSummary,
      stats,
      dailyAdherence,
      isLoading,
      isFetching,
      hasError,
      refresh: refetchAll,
      lastSync: new Date().toISOString(),
      isDoseInToleranceWindow, // Expondo para o Dashboard usar na lógica de alertas
    }),
    [
      medicinesResult.data,
      protocolsWithNextDose,
      logsResult.data,
      stockSummary,
      stats,
      dailyAdherence,
      isLoading,
      isFetching,
      hasError,
      refetchAll,
    ]
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard deve ser usado dentro de um DashboardProvider')
  }
  return context
}
