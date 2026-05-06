import { useState } from 'react'
import {
  getInitialFormData,
  validateMedicineForm,
  buildMedicinePayload,
  formatSelectedMedicine,
} from './_medicineFormUtils.js'

export function useMedicineFormState({
  medicine,
  onSave,
  onSuccess,
  autoAdvance,
  showSuccessMessage,
}) {
  const [formData, setFormData] = useState(() => getInitialFormData(medicine))
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shakeFields, setShakeFields] = useState({})
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    if (saveSuccess) {
      setSaveSuccess(false)
    }
  }

  const handleMedicineSelect = (selectedMedicine) => {
    setFormData((prev) => ({
      ...prev,
      ...formatSelectedMedicine(selectedMedicine),
    }))
    if (saveSuccess) setSaveSuccess(false)
  }

  const handleLaboratorySelect = (laboratory) => {
    setFormData((prev) => ({
      ...prev,
      laboratory: laboratory.laboratory,
    }))
    if (saveSuccess) setSaveSuccess(false)
  }

  const validate = () => {
    const newErrors = validateMedicineForm(formData)
    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      const fieldsWithError = Object.keys(newErrors)
      setShakeFields(fieldsWithError.reduce((acc, field) => ({ ...acc, [field]: true }), {}))
      setTimeout(() => setShakeFields({}), 500)
    }

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const savedMedicine = await onSave(buildMedicinePayload(formData))

      if (showSuccessMessage) setSaveSuccess(true)

      if (autoAdvance && onSuccess) {
        setTimeout(() => onSuccess(savedMedicine), 800)
      }
    } catch (error) {
      console.error('Erro ao salvar medicamento:', error)
      setErrors({ submit: error?.message || 'Erro desconhecido ao salvar medicamento' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    isSubmitting,
    shakeFields,
    saveSuccess,
    setSaveSuccess,
    handleChange,
    handleMedicineSelect,
    handleLaboratorySelect,
    handleSubmit,
  }
}
