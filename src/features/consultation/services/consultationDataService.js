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
import { calculateAdherenceStats } from '@utils/adherenceLogic'
import { calculateTitrationData } from '@utils/titrationUtils'

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
 * @returns {Object} Objeto consolidado com todos os dados clínicos
 */
export function getConsultationData(dashboardData, patientName = '', patientAge = null, patientEmail = '') {
  const { medicines, protocols, logs, stockSummary } = dashboardData

  // 1. Informações do paciente + cartão de emergência (offline, do localStorage)
  const emergencyCard = emergencyCardService.getOfflineCard()

  const patientInfo = {
    name: formatPatientDisplayName(patientName, patientEmail),
    handle: extractEmailHandle(patientEmail) || null,
    age: patientAge,
    emergencyCard: emergencyCard || null,
  }

  // 2. Medicamentos ativos (com protocolos ativos)
  const activeMedicines = _extractActiveMedicines(medicines, protocols)

  // 3. Sumário de aderência (30d e 90d)
  const adherenceSummary = _calculateAdherenceSummary(logs, protocols)

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
    generatedAt: new Date().toISOString(),
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
 * Calcula sumário de aderência para 30 e 90 dias
 * @private
 */
function _calculateAdherenceSummary(logs, protocols) {
  if (!logs || !protocols) {
    return {
      last30d: { score: 0, taken: 0, expected: 0, punctuality: 0, currentStreak: 0 },
      last90d: { score: 0, taken: 0, expected: 0, punctuality: 0, currentStreak: 0 },
      currentStreak: 0,
    }
  }

  // Filtra logs dos últimos 90 dias
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const recentLogs = logs.filter((log) => new Date(log.taken_at) >= ninetyDaysAgo)

  // Calcula stats para 30 dias
  const stats30d = calculateAdherenceStats(logs, protocols, 30)

  // Calcula stats para 90 dias
  const stats90d = calculateAdherenceStats(recentLogs, protocols, 90)

  return {
    last30d: {
      score: stats30d.score || 0,
      taken: stats30d.taken || 0,
      expected: Math.round(stats30d.expected) || 0,
      punctuality: stats30d.score || 0,
      currentStreak: stats30d.currentStreak || 0,
    },
    last90d: {
      score: stats90d.score || 0,
      taken: stats90d.taken || 0,
      expected: Math.round(stats90d.expected) || 0,
      punctuality: stats90d.score || 0,
      currentStreak: stats90d.currentStreak || 0,
    },
    currentStreak: stats30d.currentStreak || 0,
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
