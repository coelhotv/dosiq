import { useState } from 'react'
import { medicineService } from '@features/medications/services/medicineService'
import { getInitialFormData, validateStockForm, buildStockPayload } from './_stockFormUtils.js'

export function useStockFormState({ medicines, initialValues, onSave }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialValues))
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const selectedMedicine =
    medicines?.find((medicine) => medicine.id === formData.medicine_id) || null
  const isLiquid = Boolean(selectedMedicine?.dosage_unit?.endsWith('/ml'))
  // 012 Fase B2 (FR-019): injetável sem container definido → captura na 1ª compra.
  const isInjectable = selectedMedicine?.presentation === 'injetavel'
  const needsContainer = isInjectable && !selectedMedicine?.injection_container
  const regulatoryCategory = selectedMedicine?.regulatory_category || null
  const shouldAskPurchaseLaboratory = regulatoryCategory === 'Genérico'
  const fixedLaboratory = regulatoryCategory && regulatoryCategory !== 'Genérico'
  const effectiveLaboratory = shouldAskPurchaseLaboratory
    ? formData.laboratory?.trim() || null
    : selectedMedicine?.laboratory || null

  const validate = () => {
    const newErrors = validateStockForm(formData, isLiquid)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      // FR-019: persiste o container no medicine na 1ª compra (best-effort — não
      // bloqueia a compra se falhar; é só rótulo de UI). Só quando captado agora.
      if (needsContainer && formData.injection_container) {
        try {
          await medicineService.update(formData.medicine_id, {
            injection_container: formData.injection_container,
          })
        } catch (medErr) {
          console.error('Não foi possível salvar a apresentação do injetável:', medErr)
        }
      }
      await onSave(buildStockPayload(formData, effectiveLaboratory, isLiquid))
    } catch (error) {
      console.error('Erro ao salvar:', error)
      setErrors({ submit: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    formData,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    shouldAskPurchaseLaboratory,
    fixedLaboratory,
    effectiveLaboratory,
    regulatoryCategory,
    isLiquid,
    needsContainer,
  }
}
