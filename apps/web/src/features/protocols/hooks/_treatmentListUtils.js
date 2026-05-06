import { formatLocalDate, getNow } from '@utils/dateUtils'
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
  const today = formatLocalDate(getNow())
  if (protocol.end_date && protocol.end_date < today) return 'finalizado'
  if (protocol.active === false) return 'pausado'
  return 'ativo'
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

  const dosageLabel = formatDose(
    protocol.dosage_per_intake,
    protocol.medicine?.dosage_unit || 'mg',
    protocol.medicine?.dosage_per_pill
  )

  const concentrationLabel =
    protocol.medicine?.dosage_per_pill && protocol.medicine?.dosage_unit
      ? `${protocol.medicine.dosage_per_pill}${protocol.medicine.dosage_unit}`
      : null

  const n = protocol.dosage_per_intake ?? 1
  const intakeLabel = `${n} comprimido${n !== 1 ? 's' : ''}`

  const now = getNow()
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`
  const times = Array.isArray(protocol.time_schedule) ? protocol.time_schedule : []
  const nextDoseTime = times.find((t) => t > currentHHMM) || null

  return {
    id: protocol.id,
    medicineId: protocol.medicine_id,
    medicineName: protocol.medicine?.name || protocol.name,
    medicineType: protocol.medicine?.type || 'medicamento',
    dosageLabel,
    concentrationLabel,
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
    treatmentPlanId: protocol.treatment_plan?.id || null,
    treatmentPlanName: protocol.treatment_plan?.name || null,
    treatmentPlanEmoji: protocol.treatment_plan?.emoji || '💊',
    treatmentPlanColor: protocol.treatment_plan?.color || '#6366f1',
    therapeuticClass: protocol.medicine?.therapeutic_class || null,
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
