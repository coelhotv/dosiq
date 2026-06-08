import { useMemo } from 'react'
import {
  calculateDailyIntake,
  calculateDaysRemaining,
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
 * Stats de adesão do anel/score/streak a partir do resumo de `dose_instances`
 * (F3.2b, R-248) — não mais inferência ±2h sobre logs (`calculateAdherenceStats`).
 * `adherenceSummary` vem de `adherenceService.getAdherenceSummary('30d')`:
 * `{ overallScore (0-100, capado), overallTaken, overallExpected, currentStreak, longestStreak }`.
 */
function _deriveRawStats(adherenceSummary) {
  const s = adherenceSummary || {}
  const expected = s.overallExpected ?? 0
  const taken = s.overallTaken ?? 0
  // overallScore já é taken/(taken+missed)*100, capado 0-100 (sem o bug >100% do legado).
  const adherenceRate = expected > 0 ? Math.min(taken / expected, 1) : 1
  return {
    taken,
    takenAnytime: taken, // instâncias `taken` já são "no tempo" (ancoradas dentro da tolerância)
    expected,
    adherenceRate,
    currentStreak: s.currentStreak ?? 0,
    longestStreak: s.longestStreak ?? 0,
  }
}

function _deriveStockSummary(medicines, protocols) {
  const activeMedicineIds = new Set(protocols.filter((p) => p.active).map((p) => p.medicine_id))
  return medicines
    .filter((m) => activeMedicineIds.has(m.id))
    .map((medicine) => {
      const activeStockEntries = (medicine.stock || []).filter((s) => s.quantity > 0)
      const totalQuantity = activeStockEntries.reduce((sum, s) => sum + s.quantity, 0)
      // Líquidos (022): consumo convertido p/ ml (alinha ao saldo em ml).
      const dailyIntake = calculateDailyIntake(medicine.id, protocols, medicine)
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
}

function _deriveHealthScore(rawStats, stockSummary) {
  const adherenceWeight = 0.6
  const punctualityWeight = 0.2
  const stockWeight = 0.2
  // Adesão instances-based (capada 0-1). No modelo de ocorrências, "tomada" já é
  // dentro da tolerância → pontualidade ≡ adesão (a distinção do legado some).
  const adherenceRate = rawStats.adherenceRate ?? 1
  const punctualityRate = adherenceRate
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
}

function _deriveProtocolsWithNextDose(protocols) {
  return protocols.map((p) => {
    const nextDose = getNextDoseTime(p)
    return {
      ...p,
      next_dose: nextDose,
      next_dose_window_end: getNextDoseWindowEnd(nextDose),
      is_in_tolerance_window: isInToleranceWindow(nextDose),
    }
  })
}

function _deriveDailyAdherence(protocols, logs) {
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
}

/**
 * Hook privado para processamento de dados derivados do Dashboard.
 * Extraído para reduzir linhas e complexidade do useDashboardContext.
 */
export function useDashboardDerived(medicinesResult, protocolsResult, logsResult, adherenceSummaryResult = {}) {
  const medicines = useMemo(() => medicinesResult.data || [], [medicinesResult.data])
  const protocols = useMemo(() => protocolsResult.data || [], [protocolsResult.data])
  const logs = useMemo(() => logsResult.data || [], [logsResult.data])
  const adherenceSummary = useMemo(
    () => adherenceSummaryResult.data || {},
    [adherenceSummaryResult.data]
  )

  const rawStats = useMemo(() => _deriveRawStats(adherenceSummary), [adherenceSummary])

  const stockSummary = useMemo(() => _deriveStockSummary(medicines, protocols), [medicines, protocols])

  const stats = useMemo(() => _deriveHealthScore(rawStats, stockSummary), [rawStats, stockSummary])

  const protocolsWithNextDose = useMemo(() => _deriveProtocolsWithNextDose(protocols), [protocols])

  const dailyAdherence = useMemo(() => _deriveDailyAdherence(protocols, logs), [protocols, logs])

  return {
    stockSummary,
    stats,
    protocolsWithNextDose,
    dailyAdherence,
  }
}
