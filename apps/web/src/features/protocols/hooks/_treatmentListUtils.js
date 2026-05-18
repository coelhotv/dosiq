import { getNow } from '@utils/dateUtils'
import { resolveTreatmentStatus } from '@dosiq/core'
import { predictRefill } from '@stock/services/refillPredictionService'
import { getTitrationSummary, isTitrationActive, formatDose } from '@protocols/services/titrationService'

export const FREQUENCY_LABELS = {
  diario: 'Diário',
  diário: 'Diário',
  dias_alternados: 'Dias alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessario: 'Quando necessário',
  quando_necessário: 'Quando necessário',
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

function _computeIntakeLabel(dosage) {
  if (dosage == null) return '—'
  const n = dosage
  return `${n} comprimido${n !== 1 ? 's' : ''}`
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
  return `${medicine.dosage_per_pill}${medicine.dosage_unit}`
}

function _computeTreatmentPlanInfo(treatmentPlan) {
  return {
    treatmentPlanId: treatmentPlan?.id || null,
    treatmentPlanName: treatmentPlan?.name || null,
    treatmentPlanEmoji: treatmentPlan?.emoji || '💊',
    treatmentPlanColor: treatmentPlan?.color || '#6366f1',
  }
}

function _computeMedicineInfo(medicine, dosagePerIntake) {
  return {
    medicineName: medicine?.name || '—',
    medicineType: medicine?.type || 'medicamento',
    dosageLabel: formatDose(
      dosagePerIntake,
      medicine?.dosage_unit || 'mg',
      medicine?.dosage_per_pill
    ),
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

  const intakeLabel = _computeIntakeLabel(protocol.dosage_per_intake)
  const nextDoseTime = _computeNextDoseTime(protocol.time_schedule)
  const treatmentPlanInfo = _computeTreatmentPlanInfo(protocol.treatment_plan)
  const medicineInfo = _computeMedicineInfo(protocol.medicine, protocol.dosage_per_intake)
  const times = Array.isArray(protocol.time_schedule) ? protocol.time_schedule : []

  return {
    id: protocol.id,
    medicineId: protocol.medicine_id,
    intakeLabel,
    frequency: protocol.frequency,
    frequencyLabel: FREQUENCY_LABELS[protocol.frequency] || protocol.frequency,
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
