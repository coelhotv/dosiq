import { toTitleCase, toSentenceCase } from '@utils/stringUtils'
import { LIQUID_PRESENTATIONS, coerceDecimal, cleanFloat, isLiquidDosageUnit } from '@dosiq/core'
import { normalizeRegulatoryCategory } from '@schemas/medicineSchema'

// Líquido := dosage_unit termina em '/ml' (decisão-mãe 022, 053: helper único no core).
export const isLiquidUnit = isLiquidDosageUnit

// Densidade padrão (gotas/ml) sugerida quando o usuário escolhe unidade líquida (ADR-058).
export const DEFAULT_UNITS_PER_ML = 20

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(040-strict) tipar
function _getAmountDisplay(dosage_per_pill: any, concentration_volume_ml: any) {
  const denom = coerceDecimal(concentration_volume_ml)
  const amount = coerceDecimal(dosage_per_pill)
  if (dosage_per_pill !== '' && dosage_per_pill != null && denom > 0 && !isNaN(amount)) {
    return String(cleanFloat(amount * denom))
  }
  return dosage_per_pill
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(040-strict) tipar
export const getInitialFormData = (medicine: any) => {
  const m = medicine || {}
  return {
    name: m.name ?? '',
    laboratory: m.laboratory ?? '',
    active_ingredient: m.active_ingredient ?? '',
    dosage_per_pill: _getAmountDisplay(m.dosage_per_pill ?? '', m.concentration_volume_ml),
    type: m.type ?? 'medicamento',
    dosage_unit: m.dosage_unit ?? 'mg',
    units_per_ml: m.units_per_ml ?? '',
    concentration_volume_ml: m.concentration_volume_ml ?? '',
    presentation: m.presentation ?? 'comprimido',
    therapeutic_class: m.therapeutic_class ?? null,
    regulatory_category: m.regulatory_category ?? null,
    shelf_life_days: m.shelf_life_days ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(040-strict) tipar
export const validateMedicineForm = (formData: any) => {
  const newErrors: Record<string, string> = {}

  if (!formData.name?.trim()) {
    newErrors.name = 'Nome é obrigatório'
  }

  if (formData.dosage_per_pill && isNaN(coerceDecimal(formData.dosage_per_pill))) {
    newErrors.dosage_per_pill = 'Deve ser um número'
  }

  // FR-031: denominador do rótulo (concentration_volume_ml) — se informado, deve ser > 0
  // (não dividir por zero/negativo). Vazio = 1 (caso comum), sem erro.
  if (formData.concentration_volume_ml !== '' && formData.concentration_volume_ml != null) {
    const denom = coerceDecimal(formData.concentration_volume_ml)
    if (isNaN(denom) || denom <= 0) {
      newErrors.concentration_volume_ml = 'O volume (mL) deve ser maior que zero'
    }
  }

  // Densidade (units_per_ml) NÃO é capturada no cadastro do medicamento (022 Fase C):
  // pertence ao tratamento (intake_unit=gotas/UI). Sem validação aqui.

  return newErrors
}

function _getMedicinePresentation(isLiquid, presentation) {
  if (isLiquid) {
    return LIQUID_PRESENTATIONS.includes(presentation) ? presentation : 'liquido'
  }
  return presentation || 'comprimido'
}

function _getNormalizedDosage(isLiquid, dosagePerPill, concentrationVolumeMl) {
  const rawDenom = isLiquid ? coerceDecimal(concentrationVolumeMl) : NaN
  const denom = rawDenom > 0 ? rawDenom : 1
  const amount = dosagePerPill ? coerceDecimal(dosagePerPill) : null
  return {
    dosage_per_pill: amount != null ? cleanFloat(amount / denom) : null,
    concentration_volume_ml: denom !== 1 ? denom : null,
  }
}

export const buildMedicinePayload = (formData) => {
  const isLiquid = isLiquidUnit(formData.dosage_unit)
  // /ml exige apresentação líquida, mas preserva 'injetavel' (líquido-compatível) se
  // escolhido — não engole o injetável (TTL/container). Senão default 'liquido'.
  const presentation = _getMedicinePresentation(isLiquid, formData.presentation)
  // FR-031 (ADR-066): o usuário digita o `amount` do rótulo; normaliza p/ a razão mg/mL.
  // denominador (concentration_volume_ml) só p/ líquido; vazio/1 → razão = amount (passthrough)
  // e coluna NULL. ≠1 → grava razão = amount ÷ denominador + o denominador.
  const { dosage_per_pill, concentration_volume_ml } = _getNormalizedDosage(isLiquid, formData.dosage_per_pill, formData.concentration_volume_ml)

  return {
    name: formData.name.trim(),
    laboratory: formData.laboratory.trim() || null,
    active_ingredient: formData.active_ingredient.trim() || null,
    dosage_per_pill,
    concentration_volume_ml,
    type: formData.type,
    dosage_unit: formData.dosage_unit,
    // Líquido grava units_per_ml + presentation='liquido'; sólido zera units_per_ml.
    units_per_ml: isLiquid && formData.units_per_ml ? coerceDecimal(formData.units_per_ml) : null,
    presentation,
    therapeutic_class: formData.therapeutic_class || null,
    regulatory_category: formData.regulatory_category || null,
    // 012 Fase A: TTL só faz sentido para injetavel — guard no payload (defesa em
    // profundidade além da limpeza no onChange; review Gemini #658: valor obsoleto
    // de shelf_life_days não pode vazar quando a apresentação muda).
    shelf_life_days:
      presentation === 'injetavel' && formData.shelf_life_days !== '' ? formData.shelf_life_days : null,
  }
}

export const formatSelectedMedicine = (selectedMedicine) => ({
  name: selectedMedicine.name,
  active_ingredient: toTitleCase(selectedMedicine.activeIngredient),
  therapeutic_class: toSentenceCase(selectedMedicine.therapeuticClass) || null,
  regulatory_category: normalizeRegulatoryCategory(selectedMedicine.regulatoryCategory),
  laboratory: selectedMedicine.laboratory || '',
})
