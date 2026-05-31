/**
 * Consultation Data Service - Serviço de agregação de dados clínicos
 *
 * Agrega todos os dados necessários para o Modo Consulta Médica.
 * NÃO faz chamadas Supabase — usa APENAS dados do dashboardData (context).
 *
 * @module consultationDataService
 */

import { getExpiringPrescriptions } from '@prescriptions/services/prescriptionService'
import { emergencyCardService } from '@emergency/services/emergencyCardService'
import { extractEmailHandle, formatPatientDisplayName } from '@shared/utils/patientUtils'
import { calculateTitrationData } from '@utils/titrationUtils'
import { getServerTimestamp } from '@utils/dateUtils'

/**
 * Agrega todos os dados clínicos para o Modo Consulta Médica
 *
 * @param {Object} dashboardData - Dados do contexto do Dashboard
 * @param {Array} dashboardData.medicines - Lista de medicamentos
 * @param {Array} dashboardData.protocols - Lista de protocolos (com next_dose)
 * @param {Array} dashboardData.logs - Logs de doses (últimos 30 dias)
 * @param {Array} dashboardData.stockSummary - Sumário de estoque processado
 * @param {Object} dashboardData.stats - Estatísticas de aderência
 * @param {string} [patientName] - Nome do paciente (opcional)
 * @param {number} [patientAge] - Idade do paciente (opcional)
 * @param {string} [patientEmail] - Email do paciente (opcional)
 * @param {string} [userId] - ID do usuário (isolamento do cartão offline)
 * @param {{ last30d?: Object, last90d?: Object }} [adherenceSummaries] - Sumários
 *        instance-based (de `adherenceService.getAdherenceSummary`) injetados pelo
 *        caller (Opção A — service permanece sync/sem I/O). ADR-054.
 * @returns {Object} Objeto consolidado com todos os dados clínicos
 */
export function getConsultationData(
  dashboardData,
  patientName = '',
  patientAge = null,
  patientEmail = '',
  userId = null,
  adherenceSummaries = null
) {
  // Guard defensivo: dashboardData pode chegar nulo em render inicial/loading (Gemini #620).
  const { medicines, protocols, stockSummary } = dashboardData || {}

  // 1. Informações do paciente + cartão de emergência (offline, do localStorage)
  // userId obrigatório para isolamento entre usuários no mesmo dispositivo
  const emergencyCard = emergencyCardService.getOfflineCard(userId)

  const patientInfo = {
    name: formatPatientDisplayName(patientName, patientEmail),
    handle: extractEmailHandle(patientEmail) || null,
    age: patientAge,
    emergencyCard: emergencyCard || null,
  }

  // 2. Medicamentos ativos (com protocolos ativos)
  const activeMedicines = _extractActiveMedicines(medicines, protocols)

  // 3. Sumário de aderência (30d e 90d) — fonte única dose_instances (ADR-054).
  // O caller (Consultation.jsx) busca os summaries instance-based e injeta aqui,
  // mantendo este service sync/sem I/O. PDF == anel do dashboard (mesma fonte).
  const adherenceSummary = _calculateAdherenceSummary(adherenceSummaries)

  // 4. Alertas de estoque (críticos e baixos)
  const stockAlerts = _extractStockAlerts(stockSummary, medicines)

  // 5. Status de prescrições (vencendo/vencidas)
  const prescriptionStatus = _extractPrescriptionStatus(protocols)

  // 6. Titulações ativas
  const activeTitrations = _extractActiveTitrations(protocols, medicines)

  return {
    patientInfo,
    activeMedicines,
    adherenceSummary,
    stockAlerts,
    prescriptionStatus,
    activeTitrations,
    generatedAt: getServerTimestamp(),
  }
}

/**
 * Extrai medicamentos que possuem protocolos ativos
 * Inclui cálculo de dosagem real baseado nos protocolos
 * @private
 */
function _extractActiveMedicines(medicines, protocols) {
  if (!medicines || !protocols) return []

  const activeProtocolMedicineIds = new Set(
    protocols
      .filter((p) => p.active !== false) // Considera undefined como ativo
      .map((p) => p.medicine_id)
  )

  return medicines
    .filter((m) => activeProtocolMedicineIds.has(m.id))
    .map((medicine) => {
      // Busca protocolos ativos deste medicamento
      const medicineProtocols = protocols.filter(
        (p) => p.medicine_id === medicine.id && p.active !== false
      )

      // Dosagem por comprimido em mg (do cadastro do medicamento)
      // NÃO tentamos inferir do protocolo - lá temos apenas quantidade de comprimidos
      const dosagePerPill = medicine.dosage_per_pill || null
      const dosageUnit = medicine.dosage_unit || 'mg'

      // Calcula dosagens baseadas nos protocolos
      const dosageInfo = _calculateDosageInfo(medicineProtocols, dosagePerPill)

      return {
        id: medicine.id,
        name: medicine.name,
        type: medicine.type || 'comprimido',
        dosagePerPill,
        dosageUnit,
        ...dosageInfo,
        notes: medicine.notes || null,
      }
    })
}

/**
 * Calcula informações de dosagem baseado nos protocolos
 * @private
 */
function _calculateDosageInfo(protocols, dosagePerPill) {
  if (!protocols || protocols.length === 0) {
    return {
      dosagePerIntake: null,
      timesPerDay: null,
      dailyDosage: null,
    }
  }

  // Calcula totais agregando todos os protocolos do medicamento
  let totalDosagePerIntake = 0
  let totalTimesPerDay = 0

  protocols.forEach((protocol) => {
    const timesPerDay = protocol.time_schedule?.length || 1
    const pillsPerIntake = protocol.dosage_per_intake || 1

    // Se temos dosagePerPill (mg por comprimido), calcula dosagem em mg
    // Senão, retorna null para dosagens
    const dosagePerIntake = dosagePerPill ? pillsPerIntake * dosagePerPill : null

    if (dosagePerIntake !== null) {
      totalDosagePerIntake += dosagePerIntake
    }
    totalTimesPerDay += timesPerDay
  })

  // Se não conseguimos calcular nenhuma dosagem, retorna nulls
  if (totalDosagePerIntake === 0) {
    return {
      dosagePerIntake: null,
      timesPerDay: totalTimesPerDay > 0 ? totalTimesPerDay : null,
      dailyDosage: null,
    }
  }

  // Dosagem diária total = dosagem por tomada × vezes ao dia
  const dailyDosage = totalDosagePerIntake * totalTimesPerDay

  return {
    dosagePerIntake: totalDosagePerIntake,
    timesPerDay: totalTimesPerDay,
    dailyDosage,
  }
}

/**
 * Mapeia os sumários de adesão instance-based (de `adherenceService.getAdherenceSummary`)
 * para o shape do PDF/consulta. Fonte única `dose_instances` (ADR-054, R-248):
 * `overallScore` já é `taken/(taken+missed)*100` capado — sem o bug >100% do legado.
 * Não infere ±2h sobre logs (aposentou `calculateAdherenceStats`).
 *
 * @param {{ last30d?: Object, last90d?: Object }|null} adherenceSummaries
 *        Cada summary: `{ overallScore, overallTaken, overallExpected, currentStreak }`.
 * @private
 */
function _calculateAdherenceSummary(adherenceSummaries) {
  const empty = { score: 0, taken: 0, expected: 0, punctuality: 0, currentStreak: 0 }
  if (!adherenceSummaries) {
    return { last30d: { ...empty }, last90d: { ...empty }, currentStreak: 0 }
  }

  const map = (s) => ({
    score: s?.overallScore ?? 0,
    taken: s?.overallTaken ?? 0,
    expected: Math.round(s?.overallExpected ?? 0),
    // No modelo de ocorrências, "tomada" já é dentro da tolerância → pontualidade ≡ adesão.
    punctuality: s?.overallScore ?? 0,
    currentStreak: s?.currentStreak ?? 0,
  })

  const { last30d, last90d } = adherenceSummaries
  return {
    last30d: map(last30d),
    last90d: map(last90d),
    currentStreak: last30d?.currentStreak ?? 0,
  }
}

/**
 * Extrai alertas de estoque (zerado ou baixo)
 * @private
 */
function _extractStockAlerts(stockSummary, medicines) {
  if (!stockSummary) return []

  return stockSummary
    .filter((item) => item.isZero || item.isLow)
    .map((item) => {
      const medicine = medicines?.find((m) => m.id === item.medicine?.id)
      const threshold = medicine?.min_stock_threshold || 0

      return {
        medicineId: item.medicine?.id,
        medicineName: item.medicine?.name || 'Desconhecido',
        totalQuantity: item.total || 0,
        daysRemaining: item.daysRemaining || 0,
        dailyIntake: item.dailyIntake || 0,
        severity: item.isZero ? 'critical' : 'warning',
        threshold,
        message: item.isZero
          ? 'Estoque esgotado'
          : `Estoque baixo (${item.total} ${item.total === 1 ? 'unidade' : 'unidades'})`,
      }
    })
    .sort((a, b) => {
      // Ordena: críticos primeiro, depois por dias restantes
      if (a.severity === 'critical' && b.severity !== 'critical') return -1
      if (b.severity === 'critical' && a.severity !== 'critical') return 1
      return (a.daysRemaining || Infinity) - (b.daysRemaining || Infinity)
    })
}

/**
 * Extrai status de prescrições (vencidas e vencendo)
 * @private
 */
function _extractPrescriptionStatus(protocols) {
  if (!protocols) return []

  const expiring = getExpiringPrescriptions(protocols, 30)

  return expiring.map((item) => ({
    protocolId: item.protocol.id,
    medicineName: item.protocol.medicine?.name || item.protocol.medicine_name || 'Desconhecido',
    status: item.status, // 'vencida' | 'vencendo' | 'vigente'
    daysRemaining: item.daysRemaining,
    endDate: item.protocol.end_date,
    isExpiring: item.status === 'vencendo',
    isExpired: item.status === 'vencida',
  }))
}

/**
 * Extrai titulações ativas
 * @private
 */
function _extractActiveTitrations(protocols, medicines) {
  if (!protocols) return []

  return protocols
    .filter((p) => p.titration_schedule && p.titration_schedule.length > 0)
    .map((protocol) => {
      const titrationData = calculateTitrationData(protocol)
      const medicine = medicines?.find((m) => m.id === protocol.medicine_id)

      if (!titrationData) return null

      const currentStage = protocol.titration_schedule[protocol.current_stage_index || 0]

      return {
        protocolId: protocol.id,
        medicineId: protocol.medicine_id,
        medicineName: medicine?.name || protocol.medicine_name || 'Desconhecido',
        currentStep: titrationData.currentStep,
        totalSteps: titrationData.totalSteps,
        currentDay: titrationData.day,
        totalDays: titrationData.totalDays,
        progressPercent: Math.round(titrationData.progressPercent),
        isTransitionDue: titrationData.isTransitionDue,
        stageNote: titrationData.stageNote || null,
        daysRemaining: titrationData.daysRemaining,
        currentDosage: currentStage?.dosage || null,
      }
    })
    .filter(Boolean) // Remove nulls
}

export default {
  getConsultationData,
}
