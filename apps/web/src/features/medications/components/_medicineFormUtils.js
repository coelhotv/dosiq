import { toTitleCase, toSentenceCase } from '@utils/stringUtils.js'

export const getInitialFormData = (medicine = {}) => {
  const {
    name = '',
    laboratory = '',
    active_ingredient = '',
    dosage_per_pill = '',
    type = 'medicamento',
    dosage_unit = 'mg',
    therapeutic_class = null,
    regulatory_category = null,
  } = medicine

  return {
    name,
    laboratory,
    active_ingredient,
    dosage_per_pill,
    type,
    dosage_unit,
    therapeutic_class,
    regulatory_category,
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

  return newErrors
}

export const buildMedicinePayload = (formData) => ({
  name: formData.name.trim(),
  laboratory: formData.laboratory.trim() || null,
  active_ingredient: formData.active_ingredient.trim() || null,
  dosage_per_pill: formData.dosage_per_pill ? parseFloat(formData.dosage_per_pill) : null,
  type: formData.type,
  dosage_unit: formData.dosage_unit,
  therapeutic_class: formData.therapeutic_class || null,
  regulatory_category: formData.regulatory_category || null,
})

export const formatSelectedMedicine = (selectedMedicine) => ({
  name: selectedMedicine.name,
  active_ingredient: toTitleCase(selectedMedicine.activeIngredient),
  therapeutic_class: toSentenceCase(selectedMedicine.therapeuticClass) || null,
  regulatory_category: selectedMedicine.regulatoryCategory || null,
  laboratory: selectedMedicine.laboratory || '',
})
