/**
 * @fileoverview Monta os dados normalizados do PDF de consulta medica.
 * Converte o estado clinico da app em um modelo editorial pronto para renderizacao.
 * @module features/reports/services/consultationPdfDataBuilder
 */

import { addDays, formatLocalDate, parseLocalDate, parseISO, getNow } from '@utils/dateUtils.js'
import { extractEmailHandle, formatPatientDisplayName } from '@shared/utils/patientUtils'
import { calculateDailyIntake, calculateDosesByDate } from '@utils/adherenceLogic'
import {
  buildSummaryCards,
  buildAttentionItems,
  buildPatientSection,
  buildClinicalNotes,
} from './_pdfSectionBuilders'

/**
 * Formata um numero com fallback legivel.
 * @param {number|string|null|undefined} value - Valor a formatar.
 * @param {string} fallback - Texto exibido quando nao ha valor.
 * @returns {string} Texto formatado.
 */
function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function getTrendLabel(days) {
  if (days >= 90) return '90 dias'
  if (days >= 30) return '30 dias'
  if (days >= 7) return '7 dias'
  return `${days} dias`
}

function summarizeTrend(trend = [], fallbackCurrentStreak = 0) {
  const totals = trend.reduce(
    (accumulator, row) => ({
      taken: accumulator.taken + Number(row.taken ?? 0),
      expected: accumulator.expected + Number(row.expected ?? 0),
    }),
    { taken: 0, expected: 0 }
  )

  const score = totals.expected > 0 ? Math.round((totals.taken / totals.expected) * 100) : 0

  return {
    score,
    taken: totals.taken,
    expected: totals.expected,
    punctuality: score,
    currentStreak: fallbackCurrentStreak,
  }
}

/**
 * Retorna o nome clinico do tratamento.
 * @param {Object} protocol - Protocolo ativo.
 * @param {Object} medicine - Medicamento associado.
 * @returns {string} Label no formato `[tratamento] - [medicacao]`.
 */
/** Retorna o primeiro valor truthy dos argumentos. @param {...*} vals @returns {*} */
function _first(...vals) { return vals.find(Boolean) }

export function formatTreatmentLabel(protocol, medicine) {
  const treatmentName = _first(protocol?.name, protocol?.treatment_name, protocol?.medicine_name) ?? ''
  const medicineName = _first(medicine?.name, protocol?.medicine?.name, protocol?.medicine_name) ?? ''
  if (treatmentName && medicineName) return `${treatmentName} - ${medicineName}`
  return treatmentName || medicineName || 'Tratamento sem nome'
}

/**
 * Formata a apresentacao do medicamento.
 * @param {Object} medicine - Medicamento cadastrado.
 * @returns {string} Texto de apresentacao.
 */
export function formatMedicinePresentation(medicine) {
  const dosagePerPill = medicine?.dosage_per_pill
  const dosageUnit = medicine?.dosage_unit || 'mg'

  if (dosagePerPill === null || dosagePerPill === undefined) {
    return 'Apresentacao nao cadastrada'
  }

  return `${dosagePerPill} ${dosageUnit} por comprimido`
}

/**
 * Formata a dose por tomada.
 * @param {Object} protocol - Protocolo ativo.
 * @param {Object} medicine - Medicamento cadastrado.
 * @returns {string} Texto da dose por tomada.
 */
export function formatIntakeDose(protocol, medicine) {
  const pillsPerIntake = protocol?.dosage_per_intake ?? 1
  const dosagePerPill = medicine?.dosage_per_pill
  const dosageUnit = medicine?.dosage_unit || 'mg'
  const pillLabel = pillsPerIntake === 1 ? 'comprimido' : 'comprimidos'

  if (dosagePerPill === null || dosagePerPill === undefined) {
    return `${pillsPerIntake} ${pillLabel}`
  }

  const intakeAmount = pillsPerIntake * dosagePerPill
  return `${pillsPerIntake} ${pillLabel} (${intakeAmount} ${dosageUnit})`
}

/**
 * Formata a frequencia em linguagem clinica curta.
 * @param {Object} protocol - Protocolo ativo.
 * @returns {string} Texto da frequencia.
 */
export function formatFrequency(protocol) {
  const schedule = Array.isArray(protocol?.time_schedule) ? protocol.time_schedule : []
  if (schedule.length === 0) return '1x/dia'

  const schedulePreview = schedule.slice(0, 3).join(', ')
  const suffix = schedule.length > 3 ? '...' : ''
  return `${schedule.length}x/dia${schedulePreview ? ` • ${schedulePreview}${suffix}` : ''}`
}

/**
 * Formata a dose diaria total.
 * @param {Object} protocol - Protocolo ativo.
 * @param {Object} medicine - Medicamento cadastrado.
 * @returns {string} Texto da dose diaria.
 */
export function formatDailyDose(protocol, medicine) {
  const pillsPerIntake = protocol?.dosage_per_intake ?? 1
  const timesPerDay =
    Array.isArray(protocol?.time_schedule) && protocol.time_schedule.length > 0
      ? protocol.time_schedule.length
      : 1
  const dosagePerPill = medicine?.dosage_per_pill
  const dosageUnit = medicine?.dosage_unit || 'mg'

  if (dosagePerPill === null || dosagePerPill === undefined) {
    const pillsPerDay = pillsPerIntake * timesPerDay
    const pillLabel = pillsPerDay === 1 ? 'comprimido/dia' : 'comprimidos/dia'
    return `${pillsPerDay} ${pillLabel}`
  }

  const totalDosage = pillsPerIntake * timesPerDay * dosagePerPill
  return `${totalDosage} ${dosageUnit}/dia`
}

/**
 * Calcula a severidade de estoque.
 * @param {Object} stockItem - Resumo de estoque.
 * @returns {string} critical|warning|stable
 */
function getStockSeverity(stockItem) {
  if (!stockItem) return 'stable'
  if (stockItem.isZero || (stockItem.daysRemaining !== null && stockItem.daysRemaining <= 0)) {
    return 'critical'
  }
  if (stockItem.isLow || (stockItem.daysRemaining !== null && stockItem.daysRemaining < 7)) {
    return 'warning'
  }
  return 'stable'
}

/**
 * Gera rows de tratamentos para a tabela principal.
 * @param {Array<Object>} protocols - Protocolos do paciente.
 * @param {Array<Object>} medicines - Medicamentos do paciente.
 * @returns {Array<Object>} Rows prontos para renderizacao.
 */
function buildTreatmentRows(protocols = [], medicines = []) {
  return protocols
    .filter((protocol) => protocol?.active !== false)
    .map((protocol) => {
      const medicine =
        medicines.find((item) => item.id === protocol.medicine_id) || protocol.medicine || {}
      const timesPerDay =
        Array.isArray(protocol.time_schedule) && protocol.time_schedule.length > 0
          ? protocol.time_schedule.length
          : 1
      const dosagePerPill = medicine.dosage_per_pill ?? null
      const dosagePerIntake =
        dosagePerPill === null ? null : (protocol.dosage_per_intake ?? 1) * dosagePerPill

      return {
        id: protocol.id,
        label: formatTreatmentLabel(protocol, medicine),
        presentation: formatMedicinePresentation(medicine),
        dosePerIntake: formatIntakeDose(protocol, medicine),
        frequency: formatFrequency(protocol),
        dailyDose: formatDailyDose(protocol, medicine),
        status: 'Ativo',
        note: protocol.titration_schedule?.length
          ? 'Em titulacao'
          : safeText(medicine.notes, 'Sem observacoes'),
        timesPerDay,
        dosagePerIntake,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

function _resolveStockMedicine(stockItem, medicines) {
  return medicines.find((item) => item.id === stockItem?.medicine?.id)
    || stockItem?.medicine || {}
}

function _resolveStockProtocol(medicine, protocols) {
  return protocols.find((item) => item.medicine_id === medicine.id && item.active !== false)
}

function _resolveStockDays(stockItem, dailyIntake, totalQuantity) {
  if (stockItem?.daysRemaining != null) return stockItem.daysRemaining
  return dailyIntake > 0 ? Math.floor(totalQuantity / dailyIntake) : null
}

function _resolveStockMessage(stockItem) {
  if (stockItem?.isZero) return 'Estoque esgotado'
  if (stockItem?.isLow) return 'Estoque baixo'
  return 'Estoque monitorado'
}

/**
 * Mapeia um item de estoque para o formato de row do PDF.
 * @param {Object} stockItem - Item bruto de estoque
 * @param {Array} protocols - Protocolos
 * @param {Array} medicines - Medicamentos
 * @returns {Object}
 */
function _mapStockItem(stockItem, protocols, medicines) {
  const medicine = _resolveStockMedicine(stockItem, medicines)
  const protocol = _resolveStockProtocol(medicine, protocols)
  const dailyIntake = stockItem?.dailyIntake ?? calculateDailyIntake(medicine.id, protocols)
  const totalQuantity = stockItem?.total ?? 0
  const daysRemaining = _resolveStockDays(stockItem, dailyIntake, totalQuantity)
  const severity = getStockSeverity({ ...stockItem, daysRemaining })
  const id = medicine.id || stockItem?.medicine?.id || stockItem?.medicine_id || crypto.randomUUID()

  return {
    id,
    label: formatTreatmentLabel(protocol, medicine),
    medicineName: safeText(medicine.name, 'Desconhecido'),
    totalQuantity,
    dailyIntake,
    daysRemaining,
    severity,
    message: _resolveStockMessage(stockItem),
  }
}

/**
 * Gera rows de estoque ordenados por urgencia.
 * @param {Array<Object>} stockSummary - Sumario de estoque vindo do dashboard.
 * @param {Array<Object>} protocols - Protocolos ativos.
 * @param {Array<Object>} medicines - Medicamentos cadastrados.
 * @returns {Array<Object>} Rows do estoque.
 */
function buildStockRows(stockSummary = [], protocols = [], medicines = []) {
  return stockSummary
    .map((stockItem) => _mapStockItem(stockItem, protocols, medicines))
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, stable: 2 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      const aDays = a.daysRemaining ?? Number.POSITIVE_INFINITY
      const bDays = b.daysRemaining ?? Number.POSITIVE_INFINITY
      return aDays - bDays
    })
}

/**
 * Gera rows de prescricao.
 * @param {Array<Object>} prescriptionStatus - Status das prescricoes.
 * @param {Array<Object>} protocols - Protocolos.
 * @param {Array<Object>} medicines - Medicamentos.
 * @returns {Array<Object>} Rows das prescricoes.
 */
function buildPrescriptionRows(prescriptionStatus = [], protocols = [], medicines = []) {
  return prescriptionStatus.map((prescription) => {
    const protocol = protocols.find((item) => item.id === prescription.protocolId)
    const medicine =
      medicines.find((item) => item.id === protocol?.medicine_id) || protocol?.medicine || {}

    return {
      id: prescription.protocolId,
      label: formatTreatmentLabel(protocol, medicine),
      status: prescription.status,
      statusLabel:
        prescription.status === 'vencida'
          ? 'Vencida'
          : prescription.status === 'vencendo'
            ? 'Vencendo'
            : 'Vigente',
      daysRemaining: prescription.daysRemaining,
      endDate: prescription.endDate || protocol?.end_date || null,
    }
  })
}

/**
 * Gera rows de titulacao.
 * @param {Array<Object>} activeTitrations - Titulacoes ativas.
 * @param {Array<Object>} protocols - Protocolos.
 * @param {Array<Object>} medicines - Medicamentos.
 * @returns {Array<Object>} Rows da titulacao.
 */
function buildTitrationRows(activeTitrations = [], protocols = [], medicines = []) {
  return activeTitrations.map((titration) => {
    const protocol = protocols.find((item) => item.id === titration.protocolId)
    const medicine =
      medicines.find((item) => item.id === titration.medicineId) || protocol?.medicine || {}

    return {
      id: titration.protocolId,
      label: formatTreatmentLabel(protocol, medicine),
      currentStep: titration.currentStep,
      totalSteps: titration.totalSteps,
      currentDosage: titration.currentDosage,
      progressPercent: titration.progressPercent,
      daysRemaining: titration.daysRemaining,
      isTransitionDue: titration.isTransitionDue,
      stageNote: safeText(titration.stageNote, 'Sem observacoes'),
    }
  })
}

/**
 * Mapeia um score de adesão para um status legivel.
 * @param {number|null} score - Percentual de adesão (0-100) ou null
 * @param {number} expected - Doses esperadas
 * @returns {string}
 */
function _adherenceRowStatus(score, expected) {
  if (expected === 0) return 'Sem doses'
  if (score >= 90) return 'Excelente'
  if (score >= 70) return 'Atenção'
  return 'Critico'
}

/**
 * Gera uma trilha sintetica de adesao dos ultimos dias.
 * @param {Array<Object>} dailyAdherence - Série diária já consolidada pelo dashboard.
 * @param {Array<Object>} logs - Logs de dose.
 * @param {Array<Object>} protocols - Protocolos.
 * @param {number} days - Numero de dias a incluir.
 * @returns {Array<Object>} Rows com a adesao diaria.
 */
function buildAdherenceTrend(dailyAdherence = [], logs = [], protocols = [], days = 7) {
  if (Array.isArray(dailyAdherence) && dailyAdherence.length > 0) {
    return dailyAdherence.slice(-days).map((row) => {
      const taken = Number(row.taken ?? 0)
      const expected = Number(row.expected ?? 0)
      const score = expected > 0 ? Math.round((taken / expected) * 100) : null

      return {
        date: row.date,
        label: row.date
          ? parseLocalDate(row.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })
          : row.label || '',
        taken,
        expected,
        score,
        status: _adherenceRowStatus(score, expected),
      }
    })
  }

  const activeProtocols = protocols.filter((protocol) => protocol?.active !== false)
  const trend = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(getNow(), -offset)
    const dateStr = formatLocalDate(date)
    const result = calculateDosesByDate(dateStr, logs, activeProtocols)
    const taken = result.takenDoses.length
    const missed = result.missedDoses.length
    const expected = taken + missed
    const score = expected > 0 ? Math.round((taken / expected) * 100) : null

    trend.push({
      date: dateStr,
      label: parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }),
      taken,
      expected,
      score,
      status: _adherenceRowStatus(score, expected),
    })
  }

  return trend
}

/**
 * Monta os dados normalizados para renderizacao do PDF.
 * @param {Object} params - Parametros agregados.
 * @param {Object} params.consultationData - Dados consolidados do modo consulta.
 * @param {Object} params.dashboardData - Dados brutos do dashboard.
 * @param {string} [params.period='30d'] - Periodo de cobertura.
 * @param {Date|string} [params.generatedAt=getNow()] - Momento de geracao.
 * @param {string} [params.title] - Titulo do documento.
 * @returns {Object} Modelo editorial pronto para o service de PDF.
 */
/**
 * Prepara o resumo de adesão para o PDF.
 * @param {Object} consultationData - Dados de consulta
 * @param {Array} adherenceTrend - Tendência de adesão
 * @param {number} periodDays - Dias do período
 * @returns {Object} { adherence30d, adherence90d, selectedPeriodLabel, selectedPeriodSummary, currentStreak }
 */
function _prepareAdherenceSummary(consultationData, adherenceTrend, periodDays) {
  const adherence30d = consultationData?.adherenceSummary?.last30d || {
    score: 0, taken: 0, expected: 0, punctuality: 0,
  }
  const adherence90d = consultationData?.adherenceSummary?.last90d || {
    score: 0, taken: 0, expected: 0, punctuality: 0,
  }
  const selectedPeriodLabel = getTrendLabel(periodDays)
  const currentStreak = consultationData?.adherenceSummary?.currentStreak ?? adherence30d.currentStreak ?? 0

  let selectedPeriodSummary
  if (periodDays === 30) selectedPeriodSummary = adherence30d
  else if (periodDays === 90) selectedPeriodSummary = adherence90d
  else selectedPeriodSummary = summarizeTrend(adherenceTrend, currentStreak)

  return { adherence30d, adherence90d, selectedPeriodLabel, selectedPeriodSummary, currentStreak }
}

/** Extrai e normaliza dados do dashboard e consultationData. */
function _extractInputs(consultationData, dashboardData) {
  return {
    medicines: dashboardData.medicines || [],
    protocols: dashboardData.protocols || [],
    logs: dashboardData.logs || [],
    dailyAdherence: dashboardData.dailyAdherence || [],
    stockSummary: dashboardData.stockSummary || [],
    patientInfo: consultationData?.patientInfo || {},
    activeMedicines: consultationData?.activeMedicines || [],
    prescriptionStatus: consultationData?.prescriptionStatus || [],
    activeTitrations: consultationData?.activeTitrations || [],
  }
}

/** Calcula número de dias do período selecionado. */
function _calculatePeriodDays(period, dailyAdherenceLength) {
  if (period === 'all') return Math.max(dailyAdherenceLength || 0, 90)
  return Math.max(parseInt(period, 10) || 7, 1)
}

export function buildConsultationPdfData({
  consultationData,
  dashboardData = {},
  period = '30d',
  generatedAt = getNow(),
  title = 'Dosiq - Consulta Médica',
  patientEmail = '',
} = {}) {
  const inp = _extractInputs(consultationData, dashboardData)
  const periodDays = _calculatePeriodDays(period, inp.dailyAdherence.length)

  const activeTreatments = buildTreatmentRows(inp.protocols, inp.medicines)
  const stockRows = buildStockRows(inp.stockSummary, inp.protocols, inp.medicines)
  const prescriptionRows = buildPrescriptionRows(inp.prescriptionStatus, inp.protocols, inp.medicines)
  const titrationRows = buildTitrationRows(inp.activeTitrations, inp.protocols, inp.medicines)
  const adherenceTrend = buildAdherenceTrend(inp.dailyAdherence, inp.logs, inp.protocols, periodDays)
  const { adherence30d, adherence90d, selectedPeriodLabel, selectedPeriodSummary, currentStreak } =
    _prepareAdherenceSummary(consultationData, adherenceTrend, periodDays)

  const adherenceData = { selectedPeriodSummary, adherence30d, adherence90d, selectedPeriodLabel }
  const summaryCards = buildSummaryCards(
    adherenceData, activeTreatments, inp.activeMedicines, stockRows, prescriptionRows, titrationRows
  )
  const attentionItems = buildAttentionItems(stockRows, prescriptionRows, titrationRows)
  const patient = buildPatientSection(inp.patientInfo, patientEmail, formatPatientDisplayName, extractEmailHandle)
  const clinicalNotes = buildClinicalNotes(inp.patientInfo)
  const generatedAtDate = generatedAt instanceof Date ? generatedAt : parseISO(generatedAt)
  const generatedAtLabel = generatedAtDate.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

  return {
    title, period, generatedAt, generatedAtLabel, patient, summaryCards, activeTreatments,
    adherence: {
      selectedPeriod: { ...selectedPeriodSummary, label: selectedPeriodLabel },
      last30d: adherence30d, last90d: adherence90d,
      trend: adherenceTrend, trendLabel: selectedPeriodLabel, currentStreak,
    },
    stockRows, prescriptionRows, titrationRows, attentionItems, clinicalNotes,
  }
}

export default {
  buildConsultationPdfData,
  formatTreatmentLabel,
  formatMedicinePresentation,
  formatIntakeDose,
  formatFrequency,
  formatDailyDose,
}
