import { useMemo } from 'react'
import {
  getTodayLocal,
  formatLocalDate,
  parseISO,
  isProtocolActiveOnDate,
  calculateDosesByDate,
  computeAdherenceFromInstances,
  parseLocalDate,
  addDays,
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

    // 3. Estatísticas e tendências ← dose_instances (S3.6/ADR-054): adesão =
    // taken/(taken+missed), skipped_* neutro — não infere sobre logs ±2h.
    // Janela 7d (atual) vs 7d (anterior) p/ o trend. scheduled_for é instante absoluto;
    // o filtro por dia local usa boundaries via addDays (fronteira de dia no tz default).
    const instances = data.doseInstances || []
    const curStart = addDays(todayStr, -6).getTime()
    const curEnd = addDays(todayStr, 1).getTime()
    const prevStart = addDays(todayStr, -13).getTime()
    const prevEnd = curStart
    const inWindow = (inst, start, end) => {
      if (!inst?.scheduled_for) return false
      const t = parseISO(inst.scheduled_for).getTime()
      return t >= start && t < end
    }
    const curAgg = computeAdherenceFromInstances(instances.filter(i => inWindow(i, curStart, curEnd)))
    const prevAgg = computeAdherenceFromInstances(instances.filter(i => inWindow(i, prevStart, prevEnd)))
    const score = Math.round((curAgg.rate ?? 0) * 100)
    const prevScore = Math.round((prevAgg.rate ?? 0) * 100)
    const hasPreviousData = (prevAgg.taken + prevAgg.missed) > 0

    const statsWithTrend = {
      taken: curAgg.taken,
      missed: curAgg.missed,
      expected: curAgg.taken + curAgg.missed,
      score,
      trend: hasPreviousData ? (score - prevScore) : 0,
      hasPreviousData
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
