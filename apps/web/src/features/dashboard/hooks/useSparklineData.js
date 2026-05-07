/**
 * useSparklineData — Hook de processamento de dados para o SparklineAdesao.
 */
import { useMemo } from 'react'
import { getNow, addDays, formatLocalDate, getTodayLocal } from '@utils/dateUtils'
import { debugLog } from '@shared/utils/logger'

function isDateVisibleInBrazil(dateStr) {
  return dateStr <= getTodayLocal()
}

export function useSparklineData(adherenceByDay, daysCount) {
  const chartData = useMemo(() => {
    if (!adherenceByDay?.length) return []
    const today = getNow()
    const data = []

    for (let i = daysCount; i >= 1; i--) {
      const date = addDays(today, -i)
      const dateKey = formatLocalDate(date)
      if (!isDateVisibleInBrazil(dateKey)) continue

      const dayData = adherenceByDay.find((d) => d.date === dateKey)
      data.push({
        date: dateKey,
        dayName: date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }),
        adherence: dayData?.adherence ?? 0,
        taken: dayData?.taken ?? 0,
        expected: dayData?.expected ?? 0,
      })
    }
    debugLog('SparklineAdesao', `chartData final: ${data.length} dias`)
    return data
  }, [adherenceByDay, daysCount])

  const stats = useMemo(() => {
    if (!chartData.length) return { average: 0, trend: 'stable' }
    const validData = chartData.filter((d) => d.adherence > 0)
    if (!validData.length) return { average: 0, trend: 'stable' }

    const average = Math.round(validData.reduce((sum, d) => sum + d.adherence, 0) / validData.length)
    let trend = 'stable'
    if (validData.length >= 2) {
      const firstHalf = validData.slice(0, Math.floor(validData.length / 2))
      const secondHalf = validData.slice(Math.floor(validData.length / 2))
      const firstAvg = firstHalf.reduce((sum, d) => sum + d.adherence, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.adherence, 0) / secondHalf.length
      if (secondAvg > firstAvg + 5) trend = 'up'
      else if (secondAvg < firstAvg - 5) trend = 'down'
    }
    return { average, trend }
  }, [chartData])

  return { chartData, stats }
}
