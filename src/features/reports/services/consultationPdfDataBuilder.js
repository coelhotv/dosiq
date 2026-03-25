/**
 * @fileoverview Monta os dados normalizados do PDF de consulta medica.
 * Converte o estado clinico da app em um modelo editorial pronto para renderizacao.
 * @module features/reports/services/consultationPdfDataBuilder
 */

import { addDays, formatLocalDate, parseLocalDate } from '@utils/dateUtils.js'
import { extractEmailHandle, formatPatientDisplayName } from '@shared/utils/patientUtils'
import { calculateDailyIntake, calculateDosesByDate } from '@utils/adherenceLogic'

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

  const score =
    totals.expected > 0 ? Math.round((totals.taken / totals.expected) * 100) : 0

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
export function formatTreatmentLabel(protocol, medicine) {
  const treatmentName = protocol?.name || protocol?.treatment_name || protocol?.medicine_name
  const medicineName = medicine?.name || protocol?.medicine?.name || protocol?.medicine_name

  if (treatmentName && medicineName) {
    return `${treatmentName} - ${medicineName}`
  }

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
  const timesPerDay = Array.isArray(protocol?.time_schedule) && protocol.time_schedule.length > 0
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
      const medicine = medicines.find((item) => item.id === protocol.medicine_id) || protocol.medicine || {}
      const timesPerDay = Array.isArray(protocol.time_schedule) && protocol.time_schedule.length > 0
        ? protocol.time_schedule.length
        : 1
      const dosagePerPill = medicine.dosage_per_pill ?? null
      const dosagePerIntake = dosagePerPill === null
        ? null
        : (protocol.dosage_per_intake ?? 1) * dosagePerPill

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

/**
 * Gera rows de estoque ordenados por urgencia.
 * @param {Array<Object>} stockSummary - Sumario de estoque vindo do dashboard.
 * @param {Array<Object>} protocols - Protocolos ativos.
 * @param {Array<Object>} medicines - Medicamentos cadastrados.
 * @returns {Array<Object>} Rows do estoque.
 */
function buildStockRows(stockSummary = [], protocols = [], medicines = []) {
  return stockSummary
    .map((stockItem) => {
      const medicine = medicines.find((item) => item.id === stockItem?.medicine?.id) || stockItem?.medicine || {}
      const protocol = protocols.find((item) => item.medicine_id === medicine.id && item.active !== false)
      const dailyIntake = stockItem?.dailyIntake ?? calculateDailyIntake(medicine.id, protocols)
      const totalQuantity = stockItem?.total ?? 0
      const daysRemaining = stockItem?.daysRemaining ?? (
        dailyIntake > 0 ? Math.floor(totalQuantity / dailyIntake) : null
      )
      const severity = getStockSeverity({ ...stockItem, daysRemaining })

      return {
        id: medicine.id || stockItem?.medicine?.id || stockItem?.medicine_id || crypto.randomUUID(),
        label: formatTreatmentLabel(protocol, medicine),
        medicineName: safeText(medicine.name, 'Desconhecido'),
        totalQuantity,
        dailyIntake,
        daysRemaining,
        severity,
        message: stockItem?.isZero
          ? 'Estoque esgotado'
          : stockItem?.isLow
            ? 'Estoque baixo'
            : 'Estoque monitorado',
      }
    })
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
    const medicine = medicines.find((item) => item.id === protocol?.medicine_id) || protocol?.medicine || {}

    return {
      id: prescription.protocolId,
      label: formatTreatmentLabel(protocol, medicine),
      status: prescription.status,
      statusLabel: prescription.status === 'vencida'
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
    const medicine = medicines.find((item) => item.id === titration.medicineId) || protocol?.medicine || {}

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
            })
          : row.label || '',
        taken,
        expected,
        score,
        status:
          expected === 0
            ? 'Sem doses'
            : score >= 90
              ? 'Excelente'
              : score >= 70
                ? 'Atenção'
                : 'Critico',
      }
    })
  }

  const activeProtocols = protocols.filter((protocol) => protocol?.active !== false)
  const trend = []

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(new Date(), -offset)
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
      }),
      taken,
      expected,
      score,
      status:
        expected === 0
          ? 'Sem doses'
          : score >= 90
            ? 'Excelente'
            : score >= 70
              ? 'Atenção'
              : 'Critico',
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
 * @param {Date|string} [params.generatedAt=new Date()] - Momento de geracao.
 * @param {string} [params.title] - Titulo do documento.
 * @returns {Object} Modelo editorial pronto para o service de PDF.
 */
export function buildConsultationPdfData({
  consultationData,
  dashboardData = {},
  period = '30d',
  generatedAt = new Date(),
  title = 'Meus Remedios - Consulta Medica',
  patientEmail = '',
} = {}) {
  const medicines = dashboardData.medicines || []
  const protocols = dashboardData.protocols || []
  const logs = dashboardData.logs || []
  const dailyAdherence = dashboardData.dailyAdherence || []
  const stockSummary = dashboardData.stockSummary || []
  const patientInfo = consultationData?.patientInfo || {}
  const activeMedicines = consultationData?.activeMedicines || []
  const periodDays = period === 'all' ? Math.max(dailyAdherence.length || 0, 90) : Math.max(parseInt(period, 10) || 7, 1)
  const activeTreatments = buildTreatmentRows(protocols, medicines)
  const stockRows = buildStockRows(stockSummary, protocols, medicines)
  const prescriptionRows = buildPrescriptionRows(consultationData?.prescriptionStatus || [], protocols, medicines)
  const titrationRows = buildTitrationRows(consultationData?.activeTitrations || [], protocols, medicines)
  const adherenceTrend = buildAdherenceTrend(dailyAdherence, logs, protocols, periodDays)

  const adherence30d = consultationData?.adherenceSummary?.last30d || { score: 0, taken: 0, expected: 0, punctuality: 0 }
  const adherence90d = consultationData?.adherenceSummary?.last90d || { score: 0, taken: 0, expected: 0, punctuality: 0 }
  const selectedPeriodLabel = getTrendLabel(periodDays)
  const selectedPeriodSummary =
    periodDays === 30
      ? adherence30d
      : periodDays === 90
        ? adherence90d
        : summarizeTrend(
            adherenceTrend,
            consultationData?.adherenceSummary?.currentStreak ?? adherence30d.currentStreak ?? 0
          )

  const criticalStockCount = stockRows.filter((item) => item.severity === 'critical').length
  const warningStockCount = stockRows.filter((item) => item.severity === 'warning').length
  const expiringPrescriptionCount = prescriptionRows.filter((item) => item.status === 'vencendo').length
  const expiredPrescriptionCount = prescriptionRows.filter((item) => item.status === 'vencida').length
  const activeTitrationCount = titrationRows.length

  const summaryCards = [
    {
      label: `Adesao ${selectedPeriodLabel}`,
      value: `${selectedPeriodSummary.score ?? 0}%`,
      meta: `${selectedPeriodSummary.taken ?? 0}/${selectedPeriodSummary.expected ?? 0} doses`,
      tone:
        (selectedPeriodSummary.score ?? 0) >= 80
          ? 'success'
          : (selectedPeriodSummary.score ?? 0) >= 50
            ? 'warning'
            : 'danger',
    },
    {
      label: 'Adesao 30d',
      value: `${adherence30d.score ?? 0}%`,
      meta: `${adherence30d.taken ?? 0}/${adherence30d.expected ?? 0} doses`,
      tone:
        (adherence30d.score ?? 0) >= 80 ? 'success' : (adherence30d.score ?? 0) >= 50 ? 'warning' : 'danger',
    },
    {
      label: 'Adesao 90d',
      value: `${adherence90d.score ?? 0}%`,
      meta: `${adherence90d.taken ?? 0}/${adherence90d.expected ?? 0} doses`,
      tone:
        (adherence90d.score ?? 0) >= 80 ? 'success' : (adherence90d.score ?? 0) >= 50 ? 'warning' : 'danger',
    },
    {
      label: 'Pontualidade',
      value: `${selectedPeriodSummary.punctuality ?? 0}%`,
      meta: `Janela de tolerancia | ${selectedPeriodLabel}`,
      tone:
        (selectedPeriodSummary.punctuality ?? 0) >= 80
          ? 'success'
          : (selectedPeriodSummary.punctuality ?? 0) >= 50
            ? 'warning'
            : 'danger',
    },
    {
      label: 'Tratamentos ativos',
      value: String(activeTreatments.length),
      meta: `${activeMedicines.length} medicamentos`,
      tone: 'info',
    },
    {
      label: 'Alertas criticos',
      value: String(criticalStockCount + expiredPrescriptionCount),
      meta: `${warningStockCount + expiringPrescriptionCount} em atencao`,
      tone: criticalStockCount + expiredPrescriptionCount > 0 ? 'danger' : 'success',
    },
    {
      label: 'Titulações',
      value: String(activeTitrationCount),
      meta: `${titrationRows.filter((item) => item.isTransitionDue).length} pendentes`,
      tone: activeTitrationCount > 0 ? 'warning' : 'success',
    },
  ]

  const attentionItems = [
    ...stockRows
      .filter((item) => item.severity !== 'stable')
      .slice(0, 4)
      .map((item) => ({
        label: item.label,
        detail:
          item.severity === 'critical'
            ? 'Estoque esgotado'
            : `Estoque baixo: ${item.daysRemaining ?? '-'} dias`,
        tone: item.severity,
      })),
    ...prescriptionRows
      .filter((item) => item.status !== 'vigente')
      .slice(0, 4)
      .map((item) => ({
        label: item.label,
        detail:
          item.status === 'vencida'
            ? 'Prescricao vencida'
            : `${item.daysRemaining ?? '-'} dias para vencer`,
        tone: item.status === 'vencida' ? 'danger' : 'warning',
      })),
    ...titrationRows.slice(0, 3).map((item) => ({
      label: item.label,
      detail: item.isTransitionDue ? 'Transicao pendente' : `Etapa ${item.currentStep}/${item.totalSteps}`,
      tone: item.isTransitionDue ? 'warning' : 'info',
    })),
  ]

  return {
    title,
    period,
    generatedAt,
    generatedAtLabel: new Date(generatedAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    patient: {
      name: formatPatientDisplayName(patientInfo.name, patientEmail),
      age: patientInfo.age ?? null,
      handle: extractEmailHandle(patientEmail) || null,
      emergencyCard: patientInfo.emergencyCard || null,
    },
    summaryCards,
    activeTreatments,
    adherence: {
      selectedPeriod: {
        ...selectedPeriodSummary,
        label: selectedPeriodLabel,
      },
      last30d: adherence30d,
      last90d: adherence90d,
      trend: adherenceTrend,
      trendLabel: selectedPeriodLabel,
      currentStreak: consultationData?.adherenceSummary?.currentStreak ?? adherence30d.currentStreak ?? 0,
    },
    stockRows,
    prescriptionRows,
    titrationRows,
    attentionItems,
    clinicalNotes: [
      patientInfo.emergencyCard?.allergies?.length
        ? `Alergias registradas: ${patientInfo.emergencyCard.allergies.join(', ')}`
        : 'Sem alergias registradas no cartao de emergencia',
      patientInfo.emergencyCard?.blood_type
        ? `Tipo sanguineo: ${patientInfo.emergencyCard.blood_type}`
        : 'Tipo sanguineo nao informado',
    ],
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
