import { medicineService, protocolService, stockService } from '@shared/services'
import { treatmentPlanService } from '@protocols/services/treatmentPlanService'
import { FREQUENCY_LABELS } from '@schemas/protocolSchema'
import { coerceDecimal, LIQUID_PRESENTATIONS } from '@dosiq/core'

async function resolveMedicine(existing, data) {
  if (existing) return existing
  const isLiquid = data.dosage_unit?.endsWith('/ml')
  // /ml exige apresentação líquida, mas preserva 'injetavel' (líquido + TTL/container);
  // não engole o injetável só por ser /ml (mesma regra do MedicineForm).
  const presentation = isLiquid
    ? (LIQUID_PRESENTATIONS.includes(data.presentation) ? data.presentation : 'liquido')
    : data.presentation || 'comprimido'
  return medicineService.create({
    name: data.name,
    type: data.type,
    dosage_per_pill: coerceDecimal(data.dosage_per_pill),
    dosage_unit: data.dosage_unit,
    // Líquido (/ml): grava densidade; sólido zera densidade.
    units_per_ml: isLiquid && data.units_per_ml ? coerceDecimal(data.units_per_ml) : null,
    presentation,
    // TTL pós-abertura: só injetável persiste (vale também p/ injetável /ml — GLP-1).
    shelf_life_days:
      presentation === 'injetavel' && data.shelf_life_days
        ? parseInt(data.shelf_life_days, 10)
        : null,
    laboratory: data.laboratory || null,
    active_ingredient: data.active_ingredient || null,
    therapeutic_class: data.therapeutic_class || null,
    regulatory_category: data.regulatory_category || null,
  })
}

async function resolvePlan(mode, selectedId, newName, newEmoji) {
  if (mode === 'existing' && selectedId) return selectedId
  if (mode === 'new' && newName.trim()) {
    const newPlan: any = await treatmentPlanService.create({
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
      dosage_per_intake: coerceDecimal(data.dosage_per_intake),
      start_date: data.start_date,
      treatment_plan_id: planId,
      weekdays: data.weekdays || [],
    })
  }
  return null
}

// `stockTrackingEnabled === false` (spec 044) NUNCA cria estoque: em dose-only o Step3 nem
// renderiza, mas depender de `data.quantity` vir vazio seria proteção por acidente — qualquer
// default/prefill futuro no wizard religaria o FIFO pelas costas do usuário.
async function resolveStock(skipStock, data, medicineId, stockTrackingEnabled = true) {
  if (stockTrackingEnabled && !skipStock && data.quantity) {
    await stockService.add({
      medicine_id: medicineId,
      quantity: coerceDecimal(data.quantity),
      purchase_date: data.purchase_date,
      unit_price: coerceDecimal(data.unit_price) || 0,
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
  skipStock,
  stockTrackingEnabled = true
}) {
  const medicine = await resolveMedicine(selectedExistingMedicine, medicineData)
  const planId = await resolvePlan(planMode, selectedPlanId, newPlanName, newPlanEmoji)
  const protocol = await resolveProtocol(step, skipStock, medicine, protocolData, planId)
  await resolveStock(skipStock, stockData, medicine.id, stockTrackingEnabled)

  return { medicine, protocol }
}
