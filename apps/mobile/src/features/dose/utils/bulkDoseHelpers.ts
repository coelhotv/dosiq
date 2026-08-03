// bulkDoseHelpers.ts — Helper functions for bulk dose registration & tests
import { useState, useEffect } from 'react'
import { isInjectable } from '@dosiq/core'
import { getLastInjectionSite } from '../services/doseService'

// Formata data e hora para exibição amigável
export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} às ${hh}:${min}`
}

// Motivos distintos de falha (por log) p/ orientar o paciente.
export function distinctReasons(
  results: Array<{ success: boolean; error?: string }>,
  onlyFailed = false
): string[] {
  const rows = onlyFailed ? results.filter((r) => !r.success) : results
  return [...new Set(rows.map((r) => r.error).filter(Boolean) as string[])]
}

export interface BulkOutcomeResult {
  variant: 'success' | 'warning' | 'error'
  msg: string
  duration?: number
  successCount: number
}

/**
 * Monta a mensagem de resultado do registro em batch (Constituição IX —
 * Transparência Radical: NUNCA silenciar falhas/falhas parciais; sempre informar
 * quantas entraram, quantas falharam e por quê). Helper puro = testável.
 */
export function buildBulkOutcome(result: {
  success: boolean
  error?: string
  results?: Array<{ success: boolean; error?: string }>
}): BulkOutcomeResult {
  const results = result.results ?? []
  if (!result.success && results.length === 0) {
    return {
      variant: 'error',
      msg: result.error ?? 'Erro ao registrar doses.',
      duration: 7000,
      successCount: 0,
    }
  }

  const successCount = results.filter((r) => r.success).length
  const failCount = results.length - successCount

  if (failCount === 0 && successCount > 0) {
    const msg =
      successCount === 1
        ? 'Dose registrada com sucesso.'
        : `${successCount} doses registradas com sucesso.`
    return { variant: 'success', msg, successCount }
  }

  if (successCount > 0) {
    const reasons = distinctReasons(results, true)
    const detalhe = reasons.length
      ? ` Motivo${reasons.length > 1 ? 's' : ''}: ${reasons.join(' · ')}`
      : ''
    const verbo = failCount > 1 ? 'falharam' : 'falhou'
    const msg = `${successCount} de ${results.length} doses registradas. ${failCount} ${verbo}.${detalhe}`
    return { variant: 'warning', msg, duration: 7000, successCount }
  }

  const reasons = distinctReasons(results)
  const msg =
    result.error ??
    (reasons.length === 1
      ? `Nenhuma dose registrada: ${reasons[0]}`
      : reasons.length > 1
        ? `Nenhuma dose registrada. Motivos: ${reasons.join(' · ')}`
        : 'Nenhuma dose foi registrada.')
  return { variant: 'error', msg, duration: 7000, successCount: 0 }
}

/**
 * Último sítio GLOBAL (US2) p/ o bulk. Best-effort (null em erro).
 */
export function useBulkLastSite(
  visible: boolean,
  items: Array<{ protocol?: { medicine?: unknown } }>
): string | null {
  const hasInjectable = items.some((i) => isInjectable(i.protocol?.medicine))
  const [lastInjectionSite, setLastInjectionSite] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (visible && hasInjectable) {
      getLastInjectionSite().then((s) => {
        if (alive) setLastInjectionSite(s)
      })
    }
    return () => {
      alive = false
    }
  }, [visible, hasInjectable])
  return lastInjectionSite
}

export function _buildConfirmLogs(
  selectedIds: string[],
  expandedDoseItems: any[],
  finalTakenAt: string,
  isBackdated: boolean,
  instancesByKey: Record<string, string> | null,
  injectionSites: Record<string, string | null> = {}
): any[] {
  return selectedIds
    .map((id) => {
      const item = expandedDoseItems.find((i) => i.id === id)
      if (!item) return null
      const p = item.protocol
      const instanceId = isBackdated
        ? null
        : (item.instanceId ??
          (item.scheduledTime
            ? instancesByKey?.[`${p.id}|${item.scheduledTime}`] ?? null
            : null))
      const injection_site = isInjectable(p?.medicine)
        ? injectionSites[id] ?? null
        : null
      return {
        protocol_id: p.id,
        medicine_id: p.medicine?.id ?? p.medicine_id,
        taken_at: finalTakenAt,
        quantity_taken: p.dosage_per_intake ?? 1,
        injection_site,
        instance_id: instanceId,
      }
    })
    .filter(Boolean)
}

export function _expandDoseItems(protocols: any[], instancedItems: any[] | null): any[] {
  if (instancedItems) return instancedItems
  const items: any[] = []
  protocols.forEach((p) => {
    const schedules =
      p.time_schedule && p.time_schedule.length > 0 ? p.time_schedule : [null]

    schedules.forEach((time: string | null) => {
      items.push({
        id: `${p.id}-${time ?? 'adhoc'}`,
        protocol: p,
        scheduledTime: time,
        plan: p.treatment_plan,
      })
    })
  })

  items.sort((a, b) => {
    if (!a.scheduledTime) return 1
    if (!b.scheduledTime) return -1
    return a.scheduledTime.localeCompare(b.scheduledTime)
  })

  return items
}
