/**
 * Serviço de análise de custo de tratamento.
 *
 * Calcula custo mensal por medicamento usando unit_price do estoque
 * e consumo diário dos protocolos ativos.
 *
 * PRINCÍPIO: Zero chamadas ao Supabase — recebe dados já carregados.
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
  if (!stockEntries || stockEntries.length === 0) return 0

  const activeEntries = stockEntries.filter((s) => s.quantity > 0 && s.unit_price > 0)

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
  return protocols
    .filter((p) => p.medicine_id === medicineId && p.active)
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
  const items = []

  // Processar cada medicamento
  medicines.forEach((medicine) => {
    // 1. Calcular daily intake (comprimidos/dia)
    const dailyIntake = calculateDailyIntake(medicine.id, protocols)

    // Se medicamento não tem protocolo ativo, excluir
    if (dailyIntake === 0) return

    // 2. Calcular average unit price
    const avgUnitPrice = calculateAvgUnitPrice(medicine.stock)

    // 3. Calcular monthly cost
    const monthlyCost = dailyIntake * avgUnitPrice * 30

    // 4. Determinar se tem dados de preço
    const hasPriceData = avgUnitPrice > 0

    // 5. Adicionar ao array
    items.push({
      medicineId: medicine.id,
      name: medicine.name,
      dailyIntake,
      avgUnitPrice,
      monthlyCost,
      hasPriceData,
    })
  })

  // Ordenar DESC por monthlyCost
  items.sort((a, b) => b.monthlyCost - a.monthlyCost)

  // Calcular totais
  const totalMonthly = items.reduce((sum, item) => sum + item.monthlyCost, 0)
  const projection3m = calculateProjection(totalMonthly, 3)

  return {
    items,
    totalMonthly,
    projection3m,
  }
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
 * Formata valor em BRL com locale pt-BR.
 *
 * Exemplo: formatBRL(187.5) → "R$ 187,50" (ou "R$ 187,50" com espaço não-quebrável)
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
