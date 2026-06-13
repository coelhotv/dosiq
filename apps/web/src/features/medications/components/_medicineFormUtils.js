import { toTitleCase, toSentenceCase } from '@utils/stringUtils.js'
import { LIQUID_PRESENTATIONS, coerceDecimal, cleanFloat } from '@dosiq/core'

// Líquido := dosage_unit termina em '/ml' (decisão-mãe 022). Único ponto de verdade na UI web.
export const isLiquidUnit = (dosageUnit) => Boolean(dosageUnit?.endsWith('/ml'))

// Densidade padrão (gotas/ml) sugerida quando o usuário escolhe unidade líquida (ADR-058).
export const DEFAULT_UNITS_PER_ML = 20

export const getInitialFormData = (medicine = {}) => {
  const {
    name = '',
    laboratory = '',
    active_ingredient = '',
    dosage_per_pill = '',
    type = 'medicamento',
    dosage_unit = 'mg',
    units_per_ml = '',
    concentration_volume_ml = null,
    presentation = 'comprimido',
    therapeutic_class = null,
    regulatory_category = null,
    shelf_life_days = null,
  } = medicine

  // FR-031 (ADR-066): o campo exibe o `amount` do rótulo, não a razão normalizada.
  // amount = dosage_per_pill (razão mg/mL) × concentration_volume_ml. Só transforma quando
  // há denominador salvo (≠ null); senão exibe a razão crua (volume = 1, caso comum).
  const denom = Number(concentration_volume_ml)
  const amountDisplay =
    dosage_per_pill !== '' && dosage_per_pill != null && denom > 0
      ? String(cleanFloat(Number(dosage_per_pill) * denom))
      : dosage_per_pill

  return {
    name,
    laboratory,
    active_ingredient,
    dosage_per_pill: amountDisplay,
    type,
    dosage_unit,
    units_per_ml: units_per_ml ?? '',
    concentration_volume_ml: concentration_volume_ml ?? '',
    presentation,
    therapeutic_class,
    regulatory_category,
    shelf_life_days: shelf_life_days ?? '',
  }
}

export const validateMedicineForm = (formData) => {
  const newErrors = {}

  if (!formData.name.trim()) {
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

export const buildMedicinePayload = (formData) => {
  const isLiquid = isLiquidUnit(formData.dosage_unit)
  // /ml exige apresentação líquida, mas preserva 'injetavel' (líquido-compatível) se
  // escolhido — não engole o injetável (TTL/container). Senão default 'liquido'.
  const presentation = isLiquid
    ? (LIQUID_PRESENTATIONS.includes(formData.presentation) ? formData.presentation : 'liquido')
    : formData.presentation || 'comprimido'
  // FR-031 (ADR-066): o usuário digita o `amount` do rótulo; normaliza p/ a razão mg/mL.
  // denominador (concentration_volume_ml) só p/ líquido; vazio/1 → razão = amount (passthrough)
  // e coluna NULL. ≠1 → grava razão = amount ÷ denominador + o denominador.
  const rawDenom = isLiquid ? coerceDecimal(formData.concentration_volume_ml) : NaN
  const denom = rawDenom > 0 ? rawDenom : 1
  const amount = formData.dosage_per_pill ? coerceDecimal(formData.dosage_per_pill) : null
  return {
    name: formData.name.trim(),
    laboratory: formData.laboratory.trim() || null,
    active_ingredient: formData.active_ingredient.trim() || null,
    dosage_per_pill: amount != null ? cleanFloat(amount / denom) : null,
    concentration_volume_ml: denom !== 1 ? denom : null,
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
  regulatory_category: selectedMedicine.regulatoryCategory || null,
  laboratory: selectedMedicine.laboratory || '',
})
