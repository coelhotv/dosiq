import { useMemo } from 'react'
import {
  calculateDailyIntake,
  calculateDaysRemaining,
  calculateAdherenceStats,
  getNextDoseTime,
  getNextDoseWindowEnd,
  isInToleranceWindow,
  isProtocolActiveOnDate,
} from '@utils/adherenceLogic'
import {
  formatLocalDate,
  addDays,
  getSaoPauloTime,
  getNow,
  parseISO,
} from '@utils/dateUtils'

/**
 * Hook privado para processamento de dados derivados do Dashboard.
 * Extraído para reduzir linhas e complexidade do useDashboardContext.
 */
export function useDashboardDerived(medicinesResult, protocolsResult, logsResult) {
  const medicines = medicinesResult.data || []
  const protocols = protocolsResult.data || []
  const logs = logsResult.data || []

  // 1. Estatísticas de Adesão (Raw)
  const rawStats = useMemo(() => {
    if (!protocols.length || !logs.length) {
      return { score: 0, taken: 0, takenAnytime: 0, expected: 0, currentStreak: 0 }
    }
    return calculateAdherenceStats(logs, protocols, 30)
  }, [protocols, logs])

  // 2. Sumário de Estoque
  const stockSummary = useMemo(() => {
    const activeMedicineIds = new Set(protocols.filter((p) => p.active).map((p) => p.medicine_id))

    return medicines
      .filter((m) => activeMedicineIds.has(m.id))
      .map((medicine) => {
        const activeStockEntries = (medicine.stock || []).filter((s) => s.quantity > 0)
        const totalQuantity = activeStockEntries.reduce((sum, s) => sum + s.quantity, 0)

        const dailyIntake = calculateDailyIntake(medicine.id, protocols)
        const daysRemaining = calculateDaysRemaining(totalQuantity, dailyIntake)
        const threshold = medicine.min_stock_threshold || 0

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
  }, [medicines, protocols])

  // 3. Health Score Unificado
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
      score: totalScore,
      rates: {
        adherence: adherenceRate,
        punctuality: punctualityRate,
        stock: stockRate,
      },
    }
  }, [rawStats, stockSummary])

  // 4. Protocolos Enriquecidos
  const protocolsWithNextDose = useMemo(() => {
    return protocols.map((p) => {
      const nextDose = getNextDoseTime(p)
      return {
        ...p,
        next_dose: nextDose,
        next_dose_window_end: getNextDoseWindowEnd(nextDose),
        is_in_tolerance_window: isInToleranceWindow(nextDose),
      }
    })
  }, [protocols])

  // 5. Adesão Diária (7 dias)
  const dailyAdherence = useMemo(() => {
    if (!protocols.length || !logs.length) return []

    const days = 7
    const now = getNow()
    const logsByDay = new Map()

    logs.forEach((log) => {
      const dayKey = formatLocalDate(getSaoPauloTime(parseISO(log.taken_at)))
      logsByDay.set(dayKey, (logsByDay.get(dayKey) || 0) + 1)
    })

    const dailyData = []
    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(now, -i)
      const dateKey = formatLocalDate(date)

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
  }, [protocols, logs])

  return {
    stockSummary,
    stats,
    protocolsWithNextDose,
    dailyAdherence,
  }
}
