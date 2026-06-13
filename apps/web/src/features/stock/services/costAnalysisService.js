import {
  CalculateMonthlyCostsInputSchema,
  CalculateDailyIntakeInputSchema,
  CalculateAvgUnitPriceInputSchema,
  CalculateRealCostsInputSchema,
} from '@schemas/costAnalysisSchema'
import { formatLocalDate, getNow, addDays, parseISO } from '@utils/dateUtils'
import { calculateDailyIntake as coreDailyIntake, doseToMl, isLiquidMedicine, frequencyDailyFactor, cleanFloat } from '@dosiq/core'

/**
 * doses por dia de um medicamento = Σ (tomadas/dia × cadência da frequência).
 * 012 B4 / ADR-067 — base do custo/dose (custoPorDose = custoPorDia ÷ dosesPorDia).
 */
function dosesPerDayFor(protocols) {
  return (protocols || []).reduce(
    (sum, p) => sum + (p.time_schedule?.length || 1) * frequencyDailyFactor(p),
    0
  )
}

function getPriceEntries(medicine = {}) {
  if (Array.isArray(medicine.purchases) && medicine.purchases.length > 0) {
    return medicine.purchases
  }

  return medicine.stock || []
}

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
 * Fórmula: avgPrice = SUM(unit_price × quantityBase) / SUM(quantityBase)
 * quantityBase:
 * - purchases: quantity_bought
 * - fallback legado: quantity
 *
 * @param {Array} stockEntries - Array de compras ou entradas de estoque
 * @returns {number} Preço médio ou 0 se sem dados de preço
 */
export function calculateAvgUnitPrice(stockEntries = []) {
  // Validar entrada - Garantir array mesmo se null/undefined para evitar erro de Zod
  const validation = CalculateAvgUnitPriceInputSchema.safeParse({ 
    stockEntries: stockEntries || [] 
  })
  if (!validation.success) {
    console.error('Erro de validação em calculateAvgUnitPrice:', validation.error.format())
    return 0
  }

  const { stockEntries: validatedEntries } = validation.data

  if (!validatedEntries || validatedEntries.length === 0) return 0

  const activeEntries = validatedEntries
    .map((entry) => ({
      ...entry,
      quantityBase: entry.quantity_bought ?? entry.quantity ?? 0,
    }))
    .filter((s) => s.quantityBase > 0 && s.unit_price > 0)

  if (activeEntries.length === 0) return 0

  const totalValue = activeEntries.reduce((sum, s) => sum + s.unit_price * s.quantityBase, 0)
  const totalQty = activeEntries.reduce((sum, s) => sum + s.quantityBase, 0)

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
  // Filtrar protocolos com time_schedule inválido antes do Zod para evitar noise de validação (R-087)
  const sanitizedProtocols = (protocols || []).filter(p => p && p.time_schedule != null)
  
  const validation = CalculateDailyIntakeInputSchema.safeParse({ 
    medicineId, 
    protocols: sanitizedProtocols 
  })
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
 * - medicines: Array<{id, name, purchases?: Array<{quantity_bought, unit_price, ...}>, stock?: Array<{quantity, unit_price, ...}>}>
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
  const validation = CalculateMonthlyCostsInputSchema.safeParse({ 
    medicines: medicines || [], 
    protocols: protocols || [] 
  })
  if (!validation.success) {
    console.error('Erro de validação em calculateMonthlyCosts:', validation.error.format())
    return { items: [], totalMonthly: 0, projection3m: 0 }
  }

  const { medicines: validatedMedicines, protocols: validatedProtocols } = validation.data

  const items = validatedMedicines
    .map((medicine) => {
      // Líquidos (022): consumo em ml (UI/gotas ÷ densidade) p/ bater com avgUnitPrice
      // (R$/ml). Sem conversão, custo inflava (ex: insulina 100 UI × R$/ml × 30).
      const dailyIntake = coreDailyIntake(medicine.id, validatedProtocols, medicine)
      if (dailyIntake === 0) return null

      const avgUnitPrice = calculateAvgUnitPrice(getPriceEntries(medicine))
      const monthlyCost = dailyIntake * avgUnitPrice * 30
      const hasPriceData = avgUnitPrice > 0

      // 012 B4 / ADR-067: custo por DOSE (métrica primária) — preço de uma tomada,
      // não o custo/dia ilegível (R$0,071…). dailyIntake ÷ dosesPorDia = consumo de
      // uma tomada (ml ou unidades); × preço = custo/dose.
      const dosesPorDia = dosesPerDayFor(
        validatedProtocols.filter((p) => p.medicine_id === medicine.id && p.active)
      )
      const custoPorDose = dosesPorDia > 0 ? cleanFloat((dailyIntake / dosesPorDia) * avgUnitPrice) : 0
      const custoPorDia = cleanFloat(dailyIntake * avgUnitPrice)

      return {
        medicineId: medicine.id,
        name: medicine.name,
        dailyIntake,
        avgUnitPrice,
        monthlyCost,
        custoPorDose,
        custoPorDia,
        dosesPorDia,
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
  const validation = CalculateRealCostsInputSchema.safeParse({ 
    medicines: medicines || [], 
    protocols: protocols || [], 
    logs: logs || [] 
  })
  if (!validation.success) {
    console.error('Erro de validação em calculateRealCosts:', validation.error.format())
    return { items: [], totalMonthly: 0, projection3m: 0, projection6m: 0, isRealData: false }
  }

  const {
    medicines: validatedMedicines,
    protocols: validatedProtocols,
    logs: validatedLogs,
  } = validation.data

  const thirtyDaysAgo = addDays(getNow(), -30)

  // OTIMIZAÇÃO: Pré-processar dados para evitar O(M*P + M*L) → O(M + P + L)
  // Mapa de protocolos ativos por medicamento
  const activeMedicineIds = new Set()
  const protocolsByMedicine = {}
  validatedProtocols.forEach((p) => {
    if (p.active && p.medicine_id) {
      activeMedicineIds.add(p.medicine_id)
      if (!protocolsByMedicine[p.medicine_id]) {
        protocolsByMedicine[p.medicine_id] = []
      }
      protocolsByMedicine[p.medicine_id].push(p)
    }
  })

  // Mapa de logs por medicamento (com pré-filtro de data)
  const logsByMedicine = {}
  validatedLogs.forEach((l) => {
    if (l.medicine_id && parseISO(l.taken_at) >= thirtyDaysAgo) {
      if (!logsByMedicine[l.medicine_id]) {
        logsByMedicine[l.medicine_id] = []
      }
      logsByMedicine[l.medicine_id].push(l)
    }
  })

  const items = validatedMedicines
    .filter((med) => activeMedicineIds.has(med.id))
    .map((med) => {
      const medLogs = logsByMedicine[med.id] || []
      const avgUnitPrice = calculateAvgUnitPrice(getPriceEntries(med))

      // Líquidos (022): logs guardam quantity_taken na unidade de tomada (UI/gotas);
      // o estoque/preço é em ml → converter cada tomada p/ ml. intake_unit vem do
      // protocolo ativo do medicamento.
      const liquid = isLiquidMedicine(med)
      const intakeUnit = protocolsByMedicine[med.id]?.[0]?.intake_unit ?? null

      // Consumo real vs teórico
      const daysWithData = new Set(medLogs.map((l) => formatLocalDate(parseISO(l.taken_at)))).size

      let dailyConsumption
      let isRealData

      if (daysWithData >= 14) {
        // Consumo real: total consumido (convertido p/ ml se líquido) / dias com dados
        const totalConsumed = medLogs.reduce((sum, l) => {
          const qty = l.quantity_taken ?? 0
          return sum + (liquid ? doseToMl(qty, intakeUnit, med.units_per_ml) : qty)
        }, 0)
        dailyConsumption = daysWithData > 0 ? totalConsumed / daysWithData : 0
        isRealData = true
      } else {
        // Fallback: consumo teórico liquid-aware (core)
        dailyConsumption = coreDailyIntake(med.id, validatedProtocols, med)
        isRealData = false
      }

      const monthlyCost = dailyConsumption * avgUnitPrice * 30

      // 012 B4 / ADR-067: custo por DOSE primário (ver calculateMonthlyCosts).
      const dosesPorDia = dosesPerDayFor(protocolsByMedicine[med.id])
      const custoPorDose = dosesPorDia > 0 ? cleanFloat((dailyConsumption / dosesPorDia) * avgUnitPrice) : 0
      const custoPorDia = cleanFloat(dailyConsumption * avgUnitPrice)

      return {
        medicineId: med.id,
        name: med.name,
        dailyConsumption: Math.round(dailyConsumption * 100) / 100,
        avgUnitPrice,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        custoPorDose,
        custoPorDia,
        dosesPorDia,
        isRealData,
        hasPriceData: avgUnitPrice > 0,
      }
    })
    .filter((item) => item.monthlyCost > 0 || !item.hasPriceData)
    .sort((a, b) => b.monthlyCost - a.monthlyCost)

  const totalMonthly = items.reduce((sum, item) => sum + item.monthlyCost, 0)
  const isRealData = items.some((i) => i.isRealData)

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
