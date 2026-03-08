// src/features/stock/services/refillPredictionService.js

import { formatLocalDate } from '@utils/dateUtils'
import { calculateExpectedDoses } from '@utils/adherenceLogic'

/**
 * Calcula previsao de reposicao baseada em consumo REAL (logs de doses).
 * Fallback para consumo teorico se dados insuficientes (<14 dias).
 *
 * @param {Object} params
 * @param {string} params.medicineId - ID do medicamento
 * @param {number} params.currentStock - Quantidade atual em estoque
 * @param {Array} params.logs - Logs de doses dos ultimos 30 dias
 * @param {Array} params.protocols - Protocolos ativos deste medicamento
 * @returns {{
 *   daysRemaining: number,
 *   predictedStockoutDate: string|null,  // YYYY-MM-DD
 *   dailyConsumption: number,
 *   isRealData: boolean,  // true=consumo real, false=teorico
 *   confidence: 'high'|'medium'|'low'
 * }}
 */
export function predictRefill({ medicineId, currentStock, logs, protocols }) {
  // 1. Calcular consumo real (ultimos 30 dias)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0) // Zerar horas para comparacao consistente

  const recentLogs = logs.filter(log =>
    log.medicine_id === medicineId &&
    new Date(log.taken_at) >= thirtyDaysAgo
  )

  const daysWithData = getDaysWithData(recentLogs)

  let dailyConsumption
  let isRealData
  let confidence

  if (daysWithData >= 14) {
    // Consumo real: total de comprimidos consumidos / dias com dados
    const totalConsumed = recentLogs.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0)
    dailyConsumption = totalConsumed / daysWithData
    isRealData = true
    confidence = daysWithData >= 21 ? 'high' : 'medium'
  } else {
    // Fallback: consumo teorico baseado no protocolo
    // Usa calculateExpectedDoses que considera frequencia corretamente (getDailyDoseRate)
    const activeProtocols = protocols.filter(p => p.active === true)
    const expectedDaily = activeProtocols.length > 0
      ? calculateExpectedDoses(activeProtocols, 1) // 1 dia
      : 0
    dailyConsumption = expectedDaily
    isRealData = false
    confidence = 'low'
  }

  // 2. Calcular dias restantes
  let daysRemaining
  if (currentStock === 0) {
    daysRemaining = 0
  } else if (dailyConsumption > 0) {
    daysRemaining = Math.floor(currentStock / dailyConsumption)
  } else {
    daysRemaining = Infinity
  }

  // 3. Calcular data prevista de stockout
  let predictedStockoutDate = null
  if (daysRemaining !== Infinity && daysRemaining >= 0) {
    const stockoutDate = new Date()
    stockoutDate.setDate(stockoutDate.getDate() + daysRemaining)
    predictedStockoutDate = formatLocalDate(stockoutDate)
  }

  return {
    daysRemaining,
    predictedStockoutDate,
    dailyConsumption: Math.round(dailyConsumption * 100) / 100,
    isRealData,
    confidence,
  }
}

/**
 * Calcula previsao para TODOS os medicamentos com estoque.
 * Otimizado com O(M+S+P) ao inves de O(M*S*P).
 *
 * @param {Object} params
 * @param {Array} params.medicines - Todos os medicamentos
 * @param {Array} params.stocks - Todos os registros de estoque
 * @param {Array} params.logs - Todos os logs de doses (30 dias)
 * @param {Array} params.protocols - Todos os protocolos ativos
 * @returns {Array<{medicineId, name, ...prediction}>}
 */
export function predictAllRefills({ medicines, stocks, logs, protocols }) {
  // Pre-calcular mapas para O(1) lookup (fix performance: Gemini issue #6)
  const stockByMedId = stocks.reduce((acc, s) => {
    acc[s.medicine_id] = (acc[s.medicine_id] || 0) + s.quantity
    return acc
  }, {})

  const protocolsByMedId = protocols.reduce((acc, p) => {
    if (!acc[p.medicine_id]) {
      acc[p.medicine_id] = []
    }
    acc[p.medicine_id].push(p)
    return acc
  }, {})

  return medicines
    .map(med => {
      const currentStock = stockByMedId[med.id] || 0
      if (currentStock === 0) return null

      const prediction = predictRefill({
        medicineId: med.id,
        currentStock,
        logs,
        protocols: protocolsByMedId[med.id] || [],
      })

      return {
        medicineId: med.id,
        name: med.name,
        currentStock,
        ...prediction,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Tratar Infinity corretamente (fix: Gemini issue #10)
      if (a.daysRemaining === Infinity) return 1
      if (b.daysRemaining === Infinity) return -1
      return a.daysRemaining - b.daysRemaining
    })
}

/**
 * Conta dias unicos com pelo menos 1 log.
 */
function getDaysWithData(logs) {
  const uniqueDays = new Set(
    logs.map(log => formatLocalDate(new Date(log.taken_at)))
  )
  return uniqueDays.size
}
