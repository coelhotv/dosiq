import { toTitleCase, toSentenceCase } from '@utils/stringUtils.js'

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
    presentation = 'comprimido',
    therapeutic_class = null,
    regulatory_category = null,
    shelf_life_days = null,
  } = medicine

  return {
    name,
    laboratory,
    active_ingredient,
    dosage_per_pill,
    type,
    dosage_unit,
    units_per_ml: units_per_ml ?? '',
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

  if (formData.dosage_per_pill && isNaN(formData.dosage_per_pill)) {
    newErrors.dosage_per_pill = 'Deve ser um número'
  }

  // Densidade (units_per_ml) NÃO é capturada no cadastro do medicamento (022 Fase C):
  // pertence ao tratamento (intake_unit=gotas/UI). Sem validação aqui.

  return newErrors
}

export const buildMedicinePayload = (formData) => {
  const isLiquid = isLiquidUnit(formData.dosage_unit)
  return {
    name: formData.name.trim(),
    laboratory: formData.laboratory.trim() || null,
    active_ingredient: formData.active_ingredient.trim() || null,
    dosage_per_pill: formData.dosage_per_pill ? parseFloat(formData.dosage_per_pill) : null,
    type: formData.type,
    dosage_unit: formData.dosage_unit,
    // Líquido grava units_per_ml + presentation='liquido'; sólido zera units_per_ml.
    units_per_ml: isLiquid && formData.units_per_ml ? parseFloat(formData.units_per_ml) : null,
    presentation: isLiquid ? 'liquido' : formData.presentation || 'comprimido',
    therapeutic_class: formData.therapeutic_class || null,
    regulatory_category: formData.regulatory_category || null,
    // 012 Fase A: TTL pós-abertura (apenas injetavel; '' → null via Zod preprocess)
    shelf_life_days: formData.shelf_life_days !== '' ? formData.shelf_life_days : null,
  }
}

export const formatSelectedMedicine = (selectedMedicine) => ({
  name: selectedMedicine.name,
  active_ingredient: toTitleCase(selectedMedicine.activeIngredient),
  therapeutic_class: toSentenceCase(selectedMedicine.therapeuticClass) || null,
  regulatory_category: selectedMedicine.regulatoryCategory || null,
  laboratory: selectedMedicine.laboratory || '',
})
