import { useState, useCallback } from 'react'
import {
  getInitialFormData,
  validateProtocolForm,
  handleAddTime,
  handleRemoveTime,
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
}: any) {
  const [formData, setFormData] = useState(() =>
    getInitialFormData(protocol, initialValues, preselectedMedicine, isSimpleMode)
  )

  const [timeInput, setTimeInput] = useState('')
  const [errors, setErrors] = useState<any>({})
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
    [formData, isSimpleMode, autoAdvance, onSave, onSuccess, validate]
  )

  // 029 F3.1 (T017i): `handleTitrationEnable`/`setTitrationSchedule` removidos com o
  // web write-freeze — eram os escritores de `titulando`/`titration_schedule` que
  // fabricavam o zumbi do AP-301 (marcavam o status sem nunca setar `stage_started_at`).
  // A escada nasce no app, sobre `titration_steps` (029 F4).

  return {
    formData,
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
  }
}
