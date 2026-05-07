import { useState } from 'react'
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
  const regulatoryCategory = selectedMedicine?.regulatory_category || null
  const shouldAskPurchaseLaboratory = regulatoryCategory === 'Genérico'
  const fixedLaboratory = regulatoryCategory && regulatoryCategory !== 'Genérico'
  const effectiveLaboratory = shouldAskPurchaseLaboratory
    ? formData.laboratory?.trim() || null
    : selectedMedicine?.laboratory || null

  const validate = () => {
    const newErrors = validateStockForm(formData)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      await onSave(buildStockPayload(formData, effectiveLaboratory))
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
  }
}
