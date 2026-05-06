import { medicineService, protocolService, stockService } from '@shared/services'
import { treatmentPlanService } from '@protocols/services/treatmentPlanService'
import { FREQUENCY_LABELS } from '@schemas/protocolSchema'

async function resolveMedicine(existing, data) {
  if (existing) return existing
  return medicineService.create({
    name: data.name,
    type: data.type,
    dosage_per_pill: Number(data.dosage_per_pill),
    dosage_unit: data.dosage_unit,
    laboratory: data.laboratory || null,
    active_ingredient: data.active_ingredient || null,
    therapeutic_class: data.therapeutic_class || null,
    regulatory_category: data.regulatory_category || null,
  })
}

async function resolvePlan(mode, selectedId, newName, newEmoji) {
  if (mode === 'existing' && selectedId) return selectedId
  if (mode === 'new' && newName.trim()) {
    const newPlan = await treatmentPlanService.create({
      name: newName.trim(),
      emoji: newEmoji || '📋',
    })
    return newPlan.id
  }
  return null
}

async function resolveProtocol(step, skipStock, medicine, data, planId) {
  if (step >= 3 || (step === 2 && !skipStock)) {
    return protocolService.create({
      medicine_id: medicine.id,
      name: `${medicine.name} - ${FREQUENCY_LABELS[data.frequency]}`,
      frequency: data.frequency,
      time_schedule: data.time_schedule,
      dosage_per_intake: Number(data.dosage_per_intake),
      start_date: data.start_date,
      treatment_plan_id: planId,
    })
  }
  return null
}

async function resolveStock(skipStock, data, medicineId) {
  if (!skipStock && data.quantity) {
    await stockService.add({
      medicine_id: medicineId,
      quantity: Number(data.quantity),
      purchase_date: data.purchase_date,
      unit_price: Number(data.unit_price) || 0,
      expiration_date: data.expiration_date || null,
    })
  }
}

export async function submitTreatmentWizard({
  medicineData,
  selectedExistingMedicine,
  protocolData,
  stockData,
  planMode,
  selectedPlanId,
  newPlanName,
  newPlanEmoji,
  step,
  skipStock
}) {
  const medicine = await resolveMedicine(selectedExistingMedicine, medicineData)
  const planId = await resolvePlan(planMode, selectedPlanId, newPlanName, newPlanEmoji)
  const protocol = await resolveProtocol(step, skipStock, medicine, protocolData, planId)
  await resolveStock(skipStock, stockData, medicine.id)

  return { medicine, protocol }
}
