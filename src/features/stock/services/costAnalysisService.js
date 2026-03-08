import {
  CalculateMonthlyCostsInputSchema,
  CalculateDailyIntakeInputSchema,
  CalculateAvgUnitPriceInputSchema,
  CalculateRealCostsInputSchema,
} from '@schemas/costAnalysisSchema'
import { formatLocalDate } from '@utils/dateUtils'

/**
 * Serviço de análise de custo de tratamento.
 *
 * Calcula custo mensal por medicamento usando unit_price do estoque
 * e consumo diário dos protocolos ativos.
 *
 * PRINCÍPIO: Zero chamadas ao Supabase — recebe dados já carregados.
 * VALIDAÇÃO: Todas as funções validam entrada com Zod (conforme R-010).
 */

/**
 * Calcula a média ponderada do preço unitário.
 *
 * Fórmula: avgPrice = SUM(unit_price × quantity) / SUM(quantity)
 * Considera apenas entradas com quantity > 0 e unit_price > 0
 *
 * @param {Array} stockEntries - Array de {quantity, unit_price, ...}
 * @returns {number} Preço médio ou 0 se sem dados de preço
 */
export function calculateAvgUnitPrice(stockEntries = []) {
  // Validar entrada
  const validation = CalculateAvgUnitPriceInputSchema.safeParse({ stockEntries })
  if (!validation.success) {
    console.error('Erro de validação em calculateAvgUnitPrice:', validation.error.format())
    return 0
  }

  const { stockEntries: validatedEntries } = validation.data

  if (!validatedEntries || validatedEntries.length === 0) return 0

  const activeEntries = validatedEntries.filter((s) => s.quantity > 0 && s.unit_price > 0)

  if (activeEntries.length === 0) return 0

  const totalValue = activeEntries.reduce((sum, s) => sum + s.unit_price * s.quantity, 0)
  const totalQty = activeEntries.reduce((sum, s) => sum + s.quantity, 0)

  return totalQty > 0 ? totalValue / totalQty : 0
}

/**
 * Calcula o consumo diário de um medicamento em comprimidos.
 *
 * Fórmula: dailyIntake = SUM(dosage_per_intake × time_schedule.length)
 * para todos os protocolos ATIVOS daquele medicamento.
 *
 * @param {string} medicineId - ID do medicamento
 * @param {Array} protocols - Array de protocolos com {medicine_id, active, dosage_per_intake, time_schedule}
 * @returns {number} Comprimidos por dia (ou 0 se sem protocolo ativo)
 */
export function calculateDailyIntake(medicineId, protocols = []) {
  // Validar entrada
  const validation = CalculateDailyIntakeInputSchema.safeParse({ medicineId, protocols })
  if (!validation.success) {
    console.error('Erro de validação em calculateDailyIntake:', validation.error.format())
    return 0
  }

  const { medicineId: validatedId, protocols: validatedProtocols } = validation.data

  return validatedProtocols
    .filter((p) => p.medicine_id === validatedId && p.active)
    .reduce((sum, protocol) => {
      const intakesPerDay = protocol.time_schedule?.length || 0
      const dosagePerIntake = protocol.dosage_per_intake || 0
      const protocolDailyIntake = dosagePerIntake * intakesPerDay
      return sum + protocolDailyIntake
    }, 0)
}

/**
 * Calcula custo mensal por medicamento.
 *
 * Estrutura esperada de entrada:
 * - medicines: Array<{id, name, stock: Array<{quantity, unit_price, ...}>}>
 * - protocols: Array<{id, medicine_id, active, dosage_per_intake, time_schedule, ...}>
 *
 * Retorna:
 * {
 *   items: Array<{medicineId, name, dailyIntake, avgUnitPrice, monthlyCost, hasPriceData}>,
 *   totalMonthly: number,
 *   projection3m: number
 * }
 *
 * Items ordenados DESC por monthlyCost.
 * Medicamentos sem protocolo ativo são EXCLUÍDOS.
 * Medicamentos sem preço são INCLUÍDOS com monthlyCost=0 e hasPriceData=false.
 *
 * @param {Array} medicines - Medicamentos com stock embarcado
 * @param {Array} protocols - Protocolos ativos
 * @returns {object} Custos calculados
 */
export function calculateMonthlyCosts(medicines = [], protocols = []) {
  // Validar entrada
  const validation = CalculateMonthlyCostsInputSchema.safeParse({ medicines, protocols })
  if (!validation.success) {
    console.error('Erro de validação em calculateMonthlyCosts:', validation.error.format())
    return { items: [], totalMonthly: 0, projection3m: 0 }
  }

  const { medicines: validatedMedicines, protocols: validatedProtocols } = validation.data

  // OTIMIZAÇÃO: Pré-calcula consumo diário para todos os medicamentos de uma só vez.
  // Reduz complexidade de O(M*P) para O(M+P) (medicamentos * protocolos → medicamentos + protocolos)
  const dailyIntakeMap = validatedProtocols
    .filter((p) => p.active && p.medicine_id)
    .reduce((map, protocol) => {
      const intakesPerDay = protocol.time_schedule?.length || 0
      const dosagePerIntake = protocol.dosage_per_intake || 0
      const protocolDailyIntake = dosagePerIntake * intakesPerDay
      map[protocol.medicine_id] = (map[protocol.medicine_id] || 0) + protocolDailyIntake
      return map
    }, {})

  const items = validatedMedicines
    .map((medicine) => {
      const dailyIntake = dailyIntakeMap[medicine.id] || 0
      if (dailyIntake === 0) return null

      const avgUnitPrice = calculateAvgUnitPrice(medicine.stock)
      const monthlyCost = dailyIntake * avgUnitPrice * 30
      const hasPriceData = avgUnitPrice > 0

      return {
        medicineId: medicine.id,
        name: medicine.name,
        dailyIntake,
        avgUnitPrice,
        monthlyCost,
        hasPriceData,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.monthlyCost - a.monthlyCost)

  const totalMonthly = items.reduce((sum, item) => sum + item.monthlyCost, 0)
  const projection3m = calculateProjection(totalMonthly, 3)

  return { items, totalMonthly, projection3m }
}

/**
 * Calcula projeção de custo para N meses.
 *
 * @param {number} monthlyCost - Custo mensal total
 * @param {number} months - Número de meses (default: 3)
 * @returns {number} Custo projetado
 */
export function calculateProjection(monthlyCost, months = 3) {
  return monthlyCost * months
}

/**
 * Calcula custos usando consumo REAL (logs de doses).
 * Fallback para consumo teórico se dados insuficientes (<14 dias).
 *
 * @param {Object} params
 * @param {Array} params.medicines - Medicamentos com stock[] embarcado
 * @param {Array} params.protocols - Protocolos ativos
 * @param {Array} params.logs - Logs de doses (últimos 30 dias)
 * @returns {{
 *   items: Array<{medicineId, name, dailyConsumption, avgUnitPrice, monthlyCost, isRealData, hasPriceData}>,
 *   totalMonthly: number,
 *   projection3m: number,
 *   projection6m: number,
 *   isRealData: boolean
 * }}
 */
export function calculateRealCosts({ medicines = [], protocols = [], logs = [] }) {
  // Validar entrada
  const validation = CalculateRealCostsInputSchema.safeParse({ medicines, protocols, logs })
  if (!validation.success) {
    console.error('Erro de validação em calculateRealCosts:', validation.error.format())
    return { items: [], totalMonthly: 0, projection3m: 0, projection6m: 0, isRealData: false }
  }

  const { medicines: validatedMedicines, protocols: validatedProtocols, logs: validatedLogs } = validation.data

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const items = validatedMedicines
    .filter(med => validatedProtocols.some(p => p.medicine_id === med.id && p.active))
    .map(med => {
      const medLogs = validatedLogs.filter(l => l.medicine_id === med.id)
      const avgUnitPrice = calculateAvgUnitPrice(med.stock || [])

      // Consumo real vs teórico
      const recentLogs = medLogs.filter(l => new Date(l.taken_at) >= thirtyDaysAgo)
      const daysWithData = new Set(
        recentLogs.map(l => formatLocalDate(new Date(l.taken_at)))
      ).size

      let dailyConsumption
      let isRealData

      if (daysWithData >= 14) {
        // Consumo real: total de comprimidos consumidos / dias com dados
        const totalConsumed = recentLogs.reduce((sum, l) => sum + (l.quantity_taken || 0), 0)
        dailyConsumption = daysWithData > 0 ? totalConsumed / daysWithData : 0
        isRealData = true
      } else {
        // Fallback: consumo teórico baseado no protocolo
        dailyConsumption = calculateDailyIntake(med.id, validatedProtocols)
        isRealData = false
      }

      const monthlyCost = dailyConsumption * avgUnitPrice * 30

      return {
        medicineId: med.id,
        name: med.name,
        dailyConsumption: Math.round(dailyConsumption * 100) / 100,
        avgUnitPrice,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        isRealData,
        hasPriceData: avgUnitPrice > 0,
      }
    })
    .filter(item => item.monthlyCost > 0 || !item.hasPriceData)
    .sort((a, b) => b.monthlyCost - a.monthlyCost)

  const totalMonthly = items.reduce((sum, item) => sum + item.monthlyCost, 0)
  const isRealData = items.some(i => i.isRealData)

  return {
    items,
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    projection3m: calculateProjection(totalMonthly, 3),
    projection6m: calculateProjection(totalMonthly, 6),
    isRealData,
  }
}

/**
 * Formata valor em BRL com locale pt-BR.
 *
 * @param {number} value - Valor em reais
 * @returns {string} Valor formatado
 */
export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
