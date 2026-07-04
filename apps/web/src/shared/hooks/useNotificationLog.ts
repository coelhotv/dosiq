/**
 * useNotificationLog — Hook React para histórico de notificações (Web/PWA)
 *
 * Utiliza SWR via useCachedQuery para gerenciamento de cache e revalidação.
 *
 * @module useNotificationLog
 */

import { useMemo, useCallback } from 'react'
import { useCachedQuery, generateCacheKey, type UseCachedQueryResult } from '@shared/hooks/useCachedQuery'
import { createNotificationLogRepository, CACHE_KEYS } from '@dosiq/shared-data'
import { supabase } from '@shared/utils/supabase'
import { parseISO } from '@utils/dateUtils'

interface DoseEntry {
  medicineName: string
  dosage: number
}

interface NotificationLogRow {
  notification_type: string
  treatment_plan_id?: string | null
  sent_at: string
  provider_metadata?: { protocol_ids?: string[] } | null
  doses?: DoseEntry[]
  [key: string]: unknown
}

interface ProtocolRow {
  id: string
  dosage_per_intake?: number | null
  treatment_plan_id?: string
  time_schedule?: string[]
  medicine?: { name?: string } | null
}

// Repositório singleton para a plataforma web
const repo = createNotificationLogRepository({ supabase })

/**
 * Enriquece logs agrupados com lista de medicamentos via join relacional.
 * Evita duplicar dados no notification_log — busca do estado atual dos protocolos.
 */
async function enrichWithDoses(logs: NotificationLogRow[]): Promise<NotificationLogRow[]> {
  const byPlanLogs      = logs.filter(l => l.notification_type === 'dose_reminder_by_plan' && l.treatment_plan_id)
  const miscLogs        = logs.filter(l => l.notification_type === 'dose_reminder_misc')
  const planIds         = [...new Set(byPlanLogs.map(l => l.treatment_plan_id))]
  const miscProtocolIds = [...new Set(miscLogs.flatMap(l => l.provider_metadata?.protocol_ids ?? []))]

  const [planProtoMap, miscProtoMap] = await Promise.all([
    planIds.length > 0
      ? supabase
          .from('protocols')
          .select('id, dosage_per_intake, treatment_plan_id, time_schedule, medicine:medicine_id(name)')
          .in('treatment_plan_id', planIds)
          .eq('active', true)
          .then(({ data }) => {
            const map: Record<string, ProtocolRow[]> = {}
            for (const p of (data ?? []) as ProtocolRow[]) {
              if (!p.treatment_plan_id) continue
              if (!map[p.treatment_plan_id]) map[p.treatment_plan_id] = []
              map[p.treatment_plan_id].push(p)
            }
            return map
          })
      : Promise.resolve({} as Record<string, ProtocolRow[]>),

    miscProtocolIds.length > 0
      ? supabase
          .from('protocols')
          .select('id, dosage_per_intake, medicine:medicine_id(name)')
          .in('id', miscProtocolIds)
          .then(({ data }) => Object.fromEntries(((data ?? []) as ProtocolRow[]).map(p => [p.id, p])) as Record<string, ProtocolRow>)
      : Promise.resolve({} as Record<string, ProtocolRow>),
  ])

  return logs.map(log => {
    if (log.notification_type === 'dose_reminder_by_plan' && log.treatment_plan_id) {
      const d    = parseISO(log.sent_at)
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const doses = (planProtoMap[log.treatment_plan_id] ?? [])
        .filter(p => (p.time_schedule ?? []).includes(hhmm))
        .map(p => ({ medicineName: p.medicine?.name ?? 'Medicamento', dosage: p.dosage_per_intake ?? 1 }))
      return { ...log, doses }
    }
    if (log.notification_type === 'dose_reminder_misc') {
      const doses = (log.provider_metadata?.protocol_ids ?? [])
        .map(pid => miscProtoMap[pid])
        .filter((p): p is ProtocolRow => Boolean(p))
        .map(p => ({ medicineName: p.medicine?.name ?? 'Medicamento', dosage: p.dosage_per_intake ?? 1 }))
      return { ...log, doses }
    }
    return log
  })
}

export interface UseNotificationLogOptions {
  userId?: string | null
  limit?: number
  offset?: number
  enabled?: boolean
}

/**
 * Hook para buscar logs de notificações com cache SWR.
 */
export function useNotificationLog(
  options: UseNotificationLogOptions = {}
): UseCachedQueryResult<NotificationLogRow[]> {
  const { userId, limit = 20, offset = 0, enabled = true } = options

  // Chave de cache canônica e estável
  const cacheKey = useMemo(() => {
    if (!userId) return null
    return generateCacheKey(CACHE_KEYS.NOTIFICATIONS_PAGINATED, { userId, limit, offset })
  }, [userId, limit, offset])

  // Fetcher que utiliza o repositório compartilhado
  // High Priority: Memorizado para evitar loops de re-renderização
  const fetcher = useCallback(async () => {
    if (!userId) return []
    const raw = (await repo.listByUserId(userId, { limit, offset })) as NotificationLogRow[]
    return enrichWithDoses(raw)
  }, [userId, limit, offset])

  return useCachedQuery(cacheKey, fetcher, {
    enabled: enabled && !!userId,
    staleTime: 60 * 1000, // 1 minuto (Notificações têm volatilidade média)
  })
}
