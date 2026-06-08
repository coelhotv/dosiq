import { getNow } from '@utils/dateUtils'
import { resolveTreatmentStatus, getProtocolDays, formatIntakeDose, formatConcentration } from '@dosiq/core'
import { predictRefill } from '@stock/services/refillPredictionService'
import { getTitrationSummary, isTitrationActive } from '@protocols/services/titrationService'

export const FREQUENCY_LABELS = {
  diario: 'Diário',
  diário: 'Diário',
  dias_alternados: 'Dias alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessario: 'Quando necessário',
  quando_necessário: 'Quando necessário',
}

const WEEKDAY_ABBREVIATIONS = {
  domingo: 'Dom',
  segunda: 'Seg',
  terça: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sábado: 'Sáb',
}

const VISUAL_ORDER = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function formatWeekdaysLabel(weekdays = []) {
  if (!Array.isArray(weekdays) || weekdays.length === 0) return ''
  const sorted = [...weekdays].sort(
    (a, b) => VISUAL_ORDER.indexOf(a) - VISUAL_ORDER.indexOf(b)
  )
  return sorted.map((d) => WEEKDAY_ABBREVIATIONS[d] || d).join(', ')
}

/**
 * Derivar status de estoque (critical/low/normal/high) baseado em daysRemaining
 */
export function getStockStatus(daysRemaining) {
  if (!isFinite(daysRemaining)) return 'high'
  if (daysRemaining < 7) return 'critical'
  if (daysRemaining < 14) return 'low'
  if (daysRemaining < 30) return 'normal'
  return 'high'
}

/**
 * Derivar tabStatus de um protocolo
 */
export function resolveTabStatus(protocol) {
  return resolveTreatmentStatus(protocol)
}

/**
 * Resolver grupo (groupKey, label, emoji, cor) de um protocolo
 */
export function resolveGroup(protocol) {
  if (protocol.treatment_plan) {
    return {
      groupKey: `plan:${protocol.treatment_plan.id}`,
      groupLabel: protocol.treatment_plan.name,
      groupEmoji: protocol.treatment_plan.emoji || '💊',
      groupColor: protocol.treatment_plan.color || '#6366f1',
    }
  }
  if (protocol.medicine?.therapeutic_class) {
    const slug = protocol.medicine.therapeutic_class.toLowerCase().replace(/\s+/g, '-')
    return {
      groupKey: `class:${slug}`,
      groupLabel: protocol.medicine.therapeutic_class,
      groupEmoji: '💊',
      groupColor: '#6366f1',
    }
  }
  return {
    groupKey: 'avulsos',
    groupLabel: 'Medicamentos Avulsos',
    groupEmoji: '💊',
    groupColor: '#94a3b8',
  }
}

function _computeIntakeLabel(protocol) {
  const dosage = protocol?.dosage_per_intake
  if (dosage == null) return '—'
  // Líquido → unidade de tomada (gotas/ml/UI) + ≈ml; sólido → hint princípio ativo.
  return formatIntakeDose(dosage, protocol.intake_unit, protocol.medicine)
}

function _computeNextDoseTime(timeSchedule) {
  const now = getNow()
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`
  const times = Array.isArray(timeSchedule) ? timeSchedule : []
  return times.find((t) => t > currentHHMM) || null
}

function _computeConcentrationLabel(medicine) {
  if (!medicine?.dosage_per_pill || !medicine?.dosage_unit) return null
  return formatConcentration(medicine.dosage_per_pill, medicine.dosage_unit)
}

function _computeTreatmentPlanInfo(treatmentPlan) {
  return {
    treatmentPlanId: treatmentPlan?.id || null,
    treatmentPlanName: treatmentPlan?.name || null,
    treatmentPlanEmoji: treatmentPlan?.emoji || '💊',
    treatmentPlanColor: treatmentPlan?.color || '#6366f1',
  }
}

function _computeMedicineInfo(protocol) {
  const medicine = protocol?.medicine
  return {
    medicineName: medicine?.name || '—',
    medicineType: medicine?.type || 'medicamento',
    dosageLabel: formatIntakeDose(protocol?.dosage_per_intake, protocol?.intake_unit, medicine),
    concentrationLabel: _computeConcentrationLabel(medicine),
    therapeuticClass: medicine?.therapeutic_class || null,
  }
}

/**
 * Transforma um protocolo bruto em um item de tratamento processado
 */
export function transformProtocolToItem(protocol, adherenceMap, stockMap) {
  const groupInfo = resolveGroup(protocol)
  const tabStatus = resolveTabStatus(protocol)
  const totalStock = stockMap[protocol.medicine_id] ?? 0
  const titSummary = getTitrationSummary(protocol)
  const hasTitration = isTitrationActive(protocol)

  const { daysRemaining } = predictRefill({
    medicineId: protocol.medicine_id,
    currentStock: totalStock,
    logs: [],
    protocols: [protocol],
  })

  const intakeLabel = _computeIntakeLabel(protocol)
  const nextDoseTime = _computeNextDoseTime(protocol.time_schedule)
  const treatmentPlanInfo = _computeTreatmentPlanInfo(protocol.treatment_plan)
  const medicineInfo = _computeMedicineInfo(protocol)
  const times = Array.isArray(protocol.time_schedule) ? protocol.time_schedule : []

  let frequencyLabel = FREQUENCY_LABELS[protocol.frequency] || protocol.frequency
  if (protocol.frequency === 'semanal' || protocol.frequency === 'personalizado') {
    const daysSource = getProtocolDays(protocol)
    if (daysSource.length > 0) {
      frequencyLabel = `${frequencyLabel} (${formatWeekdaysLabel(daysSource)})`
    }
  }

  return {
    id: protocol.id,
    medicineId: protocol.medicine_id,
    intakeLabel,
    frequency: protocol.frequency,
    frequencyLabel,
    timeSchedule: times,
    nextDoseTime,
    isRegisteredToday: false,
    stockStatus: getStockStatus(daysRemaining),
    daysRemaining,
    adherenceScore7d: adherenceMap[protocol.id] ?? 0,
    hasTitration,
    titrationSummary: titSummary,
    notes: protocol.notes || null,
    ...medicineInfo,
    ...treatmentPlanInfo,
    ...groupInfo,
    active: protocol.active,
    endDate: protocol.end_date || null,
    tabStatus,
  }
}

/**
 * Computa grupos (planos vs classes) de uma lista de itens
 */
export function computeGroups(itemList) {
  const map = new Map()
  for (const item of itemList) {
    if (!map.has(item.groupKey)) {
      map.set(item.groupKey, {
        groupKey: item.groupKey,
        groupLabel: item.groupLabel,
        groupEmoji: item.groupEmoji,
        groupColor: item.groupColor,
        items: [],
        hasAlert: false,
        isPlan: item.groupKey.startsWith('plan:'),
      })
    }
    const g = map.get(item.groupKey)
    g.items.push(item)
    if (item.stockStatus === 'critical' || item.stockStatus === 'low') g.hasAlert = true
  }
  
  const groups = Array.from(map.values())
  const realPlans = groups.filter((g) => g.isPlan)
  const therapeuticClasses = groups.filter((g) => !g.isPlan)
  
  return [...realPlans, ...therapeuticClasses]
}
