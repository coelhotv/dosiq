/**
 * useNotificationLog — Hook Nativo para histórico de notificações (Mobile)
 *
 * Segue o padrão de resiliência offline com snapshot em AsyncStorage.
 *
 * @module useNotificationLog
 */

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { AppState } from 'react-native'
import { getTodayLocal, getNow, parseISO, addDays } from '@dosiq/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNotificationLogRepository } from '@dosiq/shared-data'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { debugLog } from '@shared/utils/debugLog'

interface DoseInfo {
  medicineName: string
  dosage: number
}

// Extrai mensagem de erro de valores que não são instâncias de Error
// (ex: erros do Supabase/fetch, que trafegam como objetos { message }).
function getErrorMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return undefined
}

interface NotificationLogRecord {
  notification_type?: string
  treatment_plan_id?: string | null
  sent_at?: string
  provider_metadata?: { protocol_ids?: string[] } | null
  doses?: DoseInfo[]
  [key: string]: unknown
}

interface ProtocolSummary {
  id: string
  dosage_per_intake?: number | null
  treatment_plan_id?: string
  time_schedule?: string[] | null
  medicine?: { name?: string } | null
}

/**
 * Gera chave de cache dinâmica por usuário para evitar vazamento de dados (Security Fix)
 * @param {string} userId
 * @returns {string}
 */
const getCacheKey = (userId: string) => `@dosiq/notif-log-snapshot:${userId}`

// Repositório singleton para a plataforma mobile
const repo = createNotificationLogRepository({ supabase })

/**
 * Enriquece logs de notificações agrupadas com a lista de medicamentos via join relacional.
 * Para by_plan: busca protocolos do treatment_plan_id filtrados pelo horário do sent_at.
 * Para misc: busca protocolos pelos IDs em provider_metadata.protocol_ids.
 * Evita duplicar dados no notification_log — busca sempre do estado atual dos protocolos.
 */
async function enrichWithDoses(logs: NotificationLogRecord[]): Promise<NotificationLogRecord[]> {
  const byPlanLogs = logs.filter(l => l.notification_type === 'dose_reminder_by_plan' && l.treatment_plan_id)
  const miscLogs   = logs.filter(l => l.notification_type === 'dose_reminder_misc')

  const planIds         = [...new Set(byPlanLogs.map(l => l.treatment_plan_id as string))]
  const miscProtocolIds = [...new Set(miscLogs.flatMap(l => l.provider_metadata?.protocol_ids ?? []))]

  const [planProtoMap, miscProtoMap] = await Promise.all([
    planIds.length > 0
      ? supabase
          .from('protocols')
          .select('id, dosage_per_intake, treatment_plan_id, time_schedule, medicine:medicine_id(name)')
          .in('treatment_plan_id', planIds)
          .eq('active', true)
          .then(({ data }) => {
            const map: Record<string, ProtocolSummary[]> = {}
            for (const p of (data ?? []) as ProtocolSummary[]) {
              const key = p.treatment_plan_id
              if (!key) continue
              if (!map[key]) map[key] = []
              map[key].push(p)
            }
            return map
          })
      : Promise.resolve({} as Record<string, ProtocolSummary[]>),

    miscProtocolIds.length > 0
      ? supabase
          .from('protocols')
          .select('id, dosage_per_intake, medicine:medicine_id(name)')
          .in('id', miscProtocolIds)
          .then(({ data }) => Object.fromEntries(
            ((data ?? []) as ProtocolSummary[]).map(p => [p.id, p]),
          ) as Record<string, ProtocolSummary>)
      : Promise.resolve({} as Record<string, ProtocolSummary>),
  ])

  return logs.map(log => {
    if (log.notification_type === 'dose_reminder_by_plan' && log.treatment_plan_id) {
      const d    = parseISO(log.sent_at as string)
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const doses = (planProtoMap[log.treatment_plan_id] ?? [])
        .filter(p => (p.time_schedule ?? []).includes(hhmm))
        .map(p => ({ medicineName: p.medicine?.name ?? 'Medicamento', dosage: p.dosage_per_intake ?? 1 }))
      return { ...log, doses }
    }

    if (log.notification_type === 'dose_reminder_misc') {
      const doses = (log.provider_metadata?.protocol_ids ?? [])
        .map(pid => miscProtoMap[pid])
        .filter((p): p is ProtocolSummary => Boolean(p))
        .map(p => ({ medicineName: p.medicine?.name ?? 'Medicamento', dosage: p.dosage_per_intake ?? 1 }))
      return { ...log, doses }
    }

    return log
  })
}

interface UseNotificationLogOptions {
  userId?: string
  limit?: number
  enabled?: boolean
}

/**
 * Hook para buscar logs de notificações com resiliência offline.
 *
 * @param {Object} options
 * @param {string} options.userId - ID do usuário (UUID)
 * @param {number} [options.limit=20] - Itens por página
 * @param {boolean} [options.enabled=true] - Se deve ativar o carregamento e listeners
 * @returns {Object} { data, loading, error, stale, refresh }
 */
export function useNotificationLog(options: UseNotificationLogOptions = {}) {
  const { userId, limit = 20, enabled = true } = options

  const [data, setData] = useState<NotificationLogRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  // Ref para evitar atualizações em componente desmontado
  const isMounted = useRef(true)

  const load = useCallback(async () => {
    if (!userId || !enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      debugLog('[useNotificationLog] Fetching notifications...')

      const raw  = await repo.listByUserId(userId, { limit })
      const logs = await enrichWithDoses(raw)

      const cacheKey = getCacheKey(userId)
      const snapshot = {
        logs,
        capturedAt: getNow().toISOString(),
        localDay: getTodayLocal(), // R-114 compat
      }

      // Persiste para uso offline
      await AsyncStorage.setItem(cacheKey, JSON.stringify(snapshot))

      if (isMounted.current) {
        setData(logs)
        setStale(false)
        setError(null)
      }
    } catch (err) {
      const message = getErrorMessage(err)
      if (__DEV__) console.warn('[useNotificationLog] Fetch failed, checking cache:', message)

      try {
        const cacheKey = getCacheKey(userId)
        const cached = await AsyncStorage.getItem(cacheKey)
        if (cached && isMounted.current) {
          const { logs } = JSON.parse(cached)
          setData(logs)
          setStale(true)
          setError(null)
        } else if (isMounted.current) {
          setError(message || 'Erro ao carregar notificações.')
        }
      } catch {
        if (isMounted.current) setError('Erro de conexão e cache ausente.')
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [userId, limit, enabled])

  useEffect(() => {
    isMounted.current = true
    startTransition(() => {
      load()
    })
    return () => {
      isMounted.current = false
    }
  }, [load])

  // Lógica de Refresh de Meia-Noite e AppState (R-184)
  // Garante que logs fiquem atualizados quando o dia muda ou app volta do background
  useEffect(() => {
    if (!enabled) return

    let midnightTimer: ReturnType<typeof setTimeout>

    const scheduleMidnightRefresh = () => {
      const now = getNow()
      const nextMidnight = addDays(now, 1)
      nextMidnight.setHours(0, 0, 0, 0)
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime()
      
      clearTimeout(midnightTimer)
      midnightTimer = setTimeout(() => {
        debugLog('[useNotificationLog] Meia-noite: Refreshing...')
        load()
        scheduleMidnightRefresh()
      }, msUntilMidnight + 1000)
    }

    scheduleMidnightRefresh()

    const handleStateChange = (nextState: string) => {
      if (nextState === 'active') {
        // Forçar um refresh leve ao voltar, opcionalmente checar se o dia mudou
        debugLog('[useNotificationLog] App active: Refreshing...')
        load()
      }
    }

    const subscription = AppState.addEventListener('change', handleStateChange)

    return () => {
      subscription.remove()
      clearTimeout(midnightTimer)
    }
  }, [load, enabled])

  return {
    data,
    loading,
    error,
    stale,
    refresh: load,
  }
}
