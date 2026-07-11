import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useCachedQueries, invalidateCache } from '@shared/hooks/useCachedQuery'
import { CACHE_KEYS, generateCacheKey } from '@dosiq/shared-data'
import { supabase, getUserId, onAuthStateChange } from '@shared/utils/supabase'
import { createDoseInstanceRepository } from '@dosiq/core'
import { isDoseInToleranceWindow } from '@utils/adherenceLogic'
import {
  formatLocalDate,
  getNow,
  getTodayLocal,
  addDays,
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
        // Ocorrências (pending/taken/missed) — fonte do "hoje" + carry-over bidirecional
        // (R-248). Janela = [ontem 00:00, amanhã 23:59] no tz do usuário (F4.3e: janela
        // actionável deslizante cross-dia; `splitDayTimeline` particiona carryOver/today/
        // lookAhead). Cross-midnight nos dois sentidos: dose de ontem 22:30 ainda no prazo
        // vira carry-over; dose de amanhã 00:30 vista às 23:30 vira lookAhead. Nunca slot
        // de hoje (preserva o fix do slot-fantasma).
        key: CACHE_KEYS.DOSE_INSTANCES_TODAY,
        fetcher: async () => {
          const userId = await getUserId()
          if (!userId) return []
          const tomorrow = formatLocalDate(addDays(getTodayLocal(), 1))
          // 012 Fase B (FR-008b): janela traseira de 4 dias — a tolerância semanal
          // (ADR-061: floor(10080/2) = 5040min = 3,5d) excede o "ontem" legado; sem
          // isso a dose GLP-1 pendente de 2-3 dias atrás sumia do carry-over.
          // splitDayTimeline continua filtrando por tolerância (sem ruído extra).
          const carryStart = formatLocalDate(addDays(getTodayLocal(), -4))
          return doseInstanceRepo.getWindow(
            userId,
            getStartOfDayISO(carryStart),
            getEndOfDayISO(tomorrow)
          )
        },
      },
      {
        // Resumo de adesão (30d) ← dose_instances (R-248). Substitui o cálculo legado
        // por inferência ±2h sobre logs no anel/score/streak. Head-count + janela 90d
        // bounded server-side (R-249). Capado 0-100 → sem o bug >100% do legado.
        // Chave parametrizada idêntica à que o serviço gera internamente
        // (generateCacheKey(..,{period})) — senão dupla gravação + invalidação não casa.
        key: generateCacheKey(CACHE_KEYS.ADHERENCE_SUMMARY, { period: '30d' }),
        fetcher: () => cachedAdherenceService.getAdherenceSummary('30d'),
      },
      {
        // Fuso do perfil (F4.3f.1) — governa a derivação do "hoje"/HH:MM e a partição
        // cross-dia (splitDayTimeline). Fallback SP quando ausente. Leitura curta/cacheada.
        // 044: a preferência de estoque viaja no MESMO select (read-path R-267) — nenhuma
        // query nova; consumidores leem `stockTrackingEnabled` do contexto.
        key: CACHE_KEYS.USER_TIMEZONE,
        fetcher: async () => {
          // Dado secundário (fallback SP no consumidor) — engole erro e retorna null
          // pra NÃO propagar hasError e travar o Dashboard inteiro (degradação suave).
          try {
            const userId = await getUserId()
            if (!userId) return null
            const { data, error } = await supabase
              .from('user_settings')
              .select('timezone, stock_tracking_enabled')
              .eq('user_id', userId)
              .maybeSingle()
            if (error) {
              console.error('Erro ao buscar settings do usuário:', error)
              return null
            }
            return {
              timezone: data?.timezone || null,
              // Fail-safe (AP-277): ausente/NULL → estoque ATIVO (FR-009). Só `false` desliga.
              stockTrackingEnabled: data?.stock_tracking_enabled !== false,
            }
          } catch (err) {
            console.error('Erro ao buscar settings do usuário:', err)
            return null
          }
        },
      },
    ],
    [streakStartLimit]
  )

  const { results, isLoading, isFetching, hasError, refetchAll } = useCachedQueries(queries)
  // Defaults `{}` defendem a janela transiente de HMR em que `results` fica com o
  // tamanho antigo (menos queries) por 1 render até o efeito re-sincronizar — evita
  // `undefined.data` derrubar o Provider e cascatear "fora do DashboardProvider".
  const [
    medicinesResult = {} as any, // TODO(040-strict)
    protocolsResult = {} as any, // TODO(040-strict)
    logsResult = {} as any, // TODO(040-strict)
    doseInstancesResult = {} as any, // TODO(040-strict)
    adherenceSummaryResult = {} as any, // TODO(040-strict)
    settingsResult = {} as any, // TODO(040-strict) — { timezone, stockTrackingEnabled }
  ] = results

  // Lógica de derivação extraída para hook privado (Lint Compliance)
  const { stockSummary, stats, protocolsWithNextDose, dailyAdherence } = useDashboardDerived(
    medicinesResult,
    protocolsResult,
    logsResult,
    adherenceSummaryResult
  )


  const value = useMemo(
    () => ({
      medicines: medicinesResult.data || [],
      protocols: protocolsWithNextDose,
      logs: logsResult.data || [],
      doseInstances: doseInstancesResult.data || [],
      timezone: settingsResult.data?.timezone || 'America/Sao_Paulo',
      // 044: default TRUE enquanto o fetch não resolve / falha (nunca esconder estoque por
      // omissão — o modo dose-only é sempre uma escolha explícita do usuário).
      stockTrackingEnabled: settingsResult.data?.stockTrackingEnabled !== false,
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
      settingsResult.data,
      stockSummary,
      stats,
      dailyAdherence,
      isLoading,
      isFetching,
      hasError,
      refetchAll,
    ]
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
        invalidateCache(CACHE_KEYS.USER_TIMEZONE)
        invalidateCache(`${CACHE_KEYS.ADHERENCE_SUMMARY}*`)
        refetchAll()
      }
    })
    return () => subscription.unsubscribe()
  }, [refetchAll])

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
