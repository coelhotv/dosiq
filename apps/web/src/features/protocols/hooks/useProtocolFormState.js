import { useState, useCallback } from 'react'
import {
  getInitialFormData,
  validateProtocolForm,
  handleAddTime,
  handleRemoveTime,
  getTitrationInitialDosage,
} from './protocolFormUtils'
import { submitProtocolForm } from './_protocolFormSubmit'

export function useProtocolFormState({
  protocol,
  initialValues,
  preselectedMedicine,
  isSimpleMode,
  onSave,
  onSuccess,
  autoAdvance,
}) {
  const [formData, setFormData] = useState(() => {
    const data = getInitialFormData(protocol, initialValues, preselectedMedicine, isSimpleMode)
    const isTitrating = protocol?.titration_schedule?.length > 0 || protocol?.titration_status === 'titulando'
    if (!protocol && isTitrating && !data.dosage_per_intake) {
      data.dosage_per_intake = getTitrationInitialDosage(data)
    }
    return data
  })

  const [enableTitration, setEnableTitration] = useState(
    protocol?.titration_schedule?.length > 0 || protocol?.titration_status === 'titulando'
  )

  const [timeInput, setTimeInput] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shakeFields, setShakeFields] = useState({})
  const [saveSuccess, setSaveSuccess] = useState(false)



  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setErrors((prev) => {
      if (prev[name]) {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      }
      return prev
    })
  }, [])

  const addTime = useCallback(() => {
    handleAddTime(timeInput, formData, setFormData, setErrors, setTimeInput)
  }, [timeInput, formData, setFormData, setErrors, setTimeInput])

  const removeTime = useCallback((time) => {
    handleRemoveTime(time, setFormData)
  }, [setFormData])

  const validate = useCallback(() => {
    return validateProtocolForm(formData, setErrors, setShakeFields)
  }, [formData])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!validate()) return

      try {
        await submitProtocolForm({
          formData,
          enableTitration,
          onSave,
          onSuccess,
          isSimpleMode,
          autoAdvance,
          setIsSubmitting,
          setErrors,
          setSaveSuccess,
        })
      } catch {
        // Error already handled in submitProtocolForm
      }
    },
    [formData, enableTitration, isSimpleMode, autoAdvance, onSave, onSuccess, validate]
  )

  const handleTitrationEnable = useCallback((enabled) => {
    setEnableTitration(enabled)
    setFormData((prev) => {
      const titration_status = enabled ? 'titulando' : 'estável'
      const dosage_per_intake = (!protocol && enabled && !prev.dosage_per_intake)
        ? getTitrationInitialDosage(prev)
        : prev.dosage_per_intake

      return {
        ...prev,
        titration_status,
        dosage_per_intake,
      }
    })
  }, [protocol])

  const setTitrationSchedule = useCallback((newSchedule) => {
    setFormData((prev) => ({ ...prev, titration_schedule: newSchedule }))
  }, [])

  return {
    formData,
    enableTitration,
    timeInput,
    errors,
    isSubmitting,
    shakeFields,
    saveSuccess,
    handleChange,
    setTimeInput,
    addTime,
    removeTime,
    handleSubmit,
    handleTitrationEnable,
    setTitrationSchedule,
  }
}
