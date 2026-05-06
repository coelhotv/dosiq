import { useMemo } from 'react'
import {
  getTodayLocal,
  formatLocalDate,
  parseISO,
  isProtocolActiveOnDate,
  calculateDosesByDate,
  calculateAdherenceStats,
  parseLocalDate,
  getNow,
  evaluateDoseTimelineState,
  getSaoPauloTime
} from '@dosiq/core'

/**
 * Hook privado para derivação de dados do Dashboard Hoje
 */
export function useTodayDerived(data) {
  return useMemo(() => {
    if (!data) return null

    const todayStr = getTodayLocal()
    
    // 0. Filtrar protocolos ativos hoje
    const validProtocols = data.protocols.filter(p => isProtocolActiveOnDate(p, todayStr))

    // 1. Filtrar logs de hoje
    const todayLogs = data.logs.filter(l => {
      return formatLocalDate(parseISO(l.taken_at)) === todayStr
    })

    // 2. Classificar doses em zonas
    const { takenDoses, missedDoses, scheduledDoses } = calculateDosesByDate(
      todayStr,
      todayLogs,
      validProtocols
    )

    // 3. Calcular estatísticas e tendências
    const stats = calculateAdherenceStats(data.logs, validProtocols, 7, 0)
    const statsPrevious = calculateAdherenceStats(data.logs, validProtocols, 7, 7)
    const scoreTrend = statsPrevious.expected > 0 ? (stats.score - statsPrevious.score) : 0

    const statsWithTrend = {
      ...stats,
      trend: scoreTrend,
      hasPreviousData: statsPrevious.expected > 0
    }

    // Helper de ordenação
    const sortByTime = (a, b) => {
      const formatTime = (d) => {
        if (d.scheduledTime) return d.scheduledTime
        if (!d.taken_at) return '00:00'
        const date = getSaoPauloTime(parseISO(d.taken_at))
        const h = String(date.getHours()).padStart(2, '0')
        const m = String(date.getMinutes()).padStart(2, '0')
        return `${h}:${m}`
      }
      return formatTime(a).localeCompare(formatTime(b))
    }

    // 4. Zonas (Late, Now, Upcoming, Done)
    const zones = {
      late: missedDoses.sort(sortByTime),
      now: scheduledDoses.filter(d => {
        const [h, m] = d.scheduledTime.split(':').map(Number)
        const scheduledDate = parseLocalDate(todayStr)
        scheduledDate.setHours(h, m, 0, 0)
        const diffHours = (getNow().getTime() - scheduledDate.getTime()) / (1000 * 60 * 60)
        return diffHours >= -0.5 && diffHours <= 2
      }).sort(sortByTime),
      upcoming: scheduledDoses.sort(sortByTime),
      done: takenDoses.sort(sortByTime)
    }

    // 5. Timeline Tática
    const timeline = evaluateDoseTimelineState(todayStr, {
      takenDoses,
      missedDoses,
      scheduledDoses
    })

    // 6. Alertas de estoque
    const stockAlerts = Object.values(data.medicines || {})
      .filter(m => (m.daysRemaining ?? Infinity) <= 7)
      .map(m => ({
        medicineId: m.id,
        medicineName: m.name,
        daysRemaining: m.daysRemaining
      }))

    return {
      ...data,
      stats: statsWithTrend,
      zones,
      timeline,
      stockAlerts
    }
  }, [data])
}
