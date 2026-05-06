import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useCachedQueries, invalidateCache } from '@shared/hooks/useCachedQuery'
import { CACHE_KEYS } from '@dosiq/shared-data'
import { onAuthStateChange } from '@shared/utils/supabase'
import { isDoseInToleranceWindow } from '@utils/adherenceLogic'
import { formatLocalDate, getNow, getTodayLocal } from '@utils/dateUtils'
import { medicineService } from '@medications/services/medicineService'
import { protocolService } from '@protocols/services/protocolService'
import { logService } from '@shared/services/api/logService'

import { useDashboardDerived } from './_useDashboardDerived'

const DashboardContext = createContext(null)

/**
 * useDashboardContext - Orquestrador de dados do Health Command Center
 *
 * Centraliza as queries de medicamentos, protocolos e logs para
 * garantir consistência de dados e "custo zero" de queries extras.
 */
export function DashboardProvider({ children }) {
  const streakStartLimit = useMemo(() => {
    const date = getNow()
    date.setDate(date.getDate() - 365) // 1 ano de histórico para streak profundo
    return formatLocalDate(date)
  }, [])

  const queries = useMemo(
    () => [
      {
        key: CACHE_KEYS.MEDICINES,
        fetcher: () => medicineService.getAll(),
      },
      {
        key: CACHE_KEYS.PROTOCOLS, // Buscamos todos para histórico real de adesão e streak
        fetcher: () => protocolService.getAll(),
      },
      {
        key: CACHE_KEYS.LOGS_DEEP_STREAK,
        fetcher: async () => {
          const result = await logService.getByDateRangeSlim(
            streakStartLimit,
            getTodayLocal(),
            1500
          )
          return result.data
        },
      },
    ],
    [streakStartLimit]
  )

  const { results, isLoading, isFetching, hasError, refetchAll } = useCachedQueries(queries)
  const [medicinesResult, protocolsResult, logsResult] = results

  // Lógica de derivação extraída para hook privado (Lint Compliance)
  const { stockSummary, stats, protocolsWithNextDose, dailyAdherence } = useDashboardDerived(
    medicinesResult,
    protocolsResult,
    logsResult
  )


  // Assina eventos de autenticação — invalida cache imediatamente no SIGNED_IN/SIGNED_OUT
  useEffect(() => {
    const {
      data: { subscription },
    } = onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        invalidateCache(CACHE_KEYS.MEDICINES)
        invalidateCache(CACHE_KEYS.PROTOCOLS)
        invalidateCache(CACHE_KEYS.LOGS_DEEP_STREAK)
        refetchAll({ force: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [refetchAll])


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
      lastSync: getNow().toISOString(),
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
