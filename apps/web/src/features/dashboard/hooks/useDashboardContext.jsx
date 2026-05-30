import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useCachedQueries, invalidateCache } from '@shared/hooks/useCachedQuery'
import { CACHE_KEYS } from '@dosiq/shared-data'
import { supabase, getUserId, onAuthStateChange } from '@shared/utils/supabase'
import { createDoseInstanceRepository } from '@dosiq/core'
import { isDoseInToleranceWindow } from '@utils/adherenceLogic'
import {
  formatLocalDate,
  getNow,
  getTodayLocal,
  getStartOfDayISO,
  getEndOfDayISO,
} from '@utils/dateUtils'
import { medicineService } from '@medications/services/medicineService'
import { protocolService } from '@protocols/services/protocolService'
import { logService } from '@shared/services/api/logService'
import { cachedAdherenceService } from '@shared/services'

import { useDashboardDerived } from './_useDashboardDerived'

// Repository de dose_instances — o "hoje" do dashboard consome ocorrências
// materializadas por status (pending/taken) em vez de inferir slots ±2h sobre
// logs (R-248). Janela curta (1 dia) → OOM-safe (R-249).
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase })

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
      {
        // Ocorrências do dia (pending/taken/missed) — fonte do "hoje" (R-248).
        // Janela = dia local [00:00, 23:59] no tz do usuário. Cross-midnight:
        // a dose de ontem 22:30 tem scheduled_for de ontem → não entra na janela
        // de hoje → não cria slot fantasma de hoje (fix visível).
        key: CACHE_KEYS.DOSE_INSTANCES_TODAY,
        fetcher: async () => {
          const userId = await getUserId()
          if (!userId) return []
          const today = getTodayLocal()
          return doseInstanceRepo.getWindow(
            userId,
            getStartOfDayISO(today),
            getEndOfDayISO(today)
          )
        },
      },
      {
        // Resumo de adesão (30d) ← dose_instances (R-248). Substitui o cálculo legado
        // por inferência ±2h sobre logs no anel/score/streak. Head-count + janela 90d
        // bounded server-side (R-249). Capado 0-100 → sem o bug >100% do legado.
        key: CACHE_KEYS.ADHERENCE_SUMMARY,
        fetcher: () => cachedAdherenceService.getAdherenceSummary('30d'),
      },
    ],
    [streakStartLimit]
  )

  const { results, isLoading, isFetching, hasError, refetchAll } = useCachedQueries(queries)
  // Defaults `{}` defendem a janela transiente de HMR em que `results` fica com o
  // tamanho antigo (menos queries) por 1 render até o efeito re-sincronizar — evita
  // `undefined.data` derrubar o Provider e cascatear "fora do DashboardProvider".
  const [
    medicinesResult = {},
    protocolsResult = {},
    logsResult = {},
    doseInstancesResult = {},
    adherenceSummaryResult = {},
  ] = results

  // Lógica de derivação extraída para hook privado (Lint Compliance)
  const { stockSummary, stats, protocolsWithNextDose, dailyAdherence } = useDashboardDerived(
    medicinesResult,
    protocolsResult,
    logsResult,
    adherenceSummaryResult
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
        invalidateCache(CACHE_KEYS.DOSE_INSTANCES_TODAY)
        invalidateCache(CACHE_KEYS.ADHERENCE_SUMMARY)
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
      doseInstances: doseInstancesResult.data || [],
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
      doseInstancesResult.data,
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
