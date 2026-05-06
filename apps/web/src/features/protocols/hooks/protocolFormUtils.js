import { getTodayDateString } from '@schemas/protocolSchema'

export const getInitialFormData = (protocol, initialValues, preselectedMedicine, isSimpleMode) => ({
  medicine_id:
    protocol?.medicine_id || initialValues?.medicine_id || preselectedMedicine?.id || '',
  treatment_plan_id: protocol?.treatment_plan_id || initialValues?.treatment_plan_id || '',
  name:
    protocol?.name ||
    initialValues?.name ||
    (isSimpleMode && preselectedMedicine ? `${preselectedMedicine.name} - Tratamento` : ''),
  frequency: protocol?.frequency || initialValues?.frequency || 'diário',
  time_schedule: protocol?.time_schedule || initialValues?.time_schedule || [],
  dosage_per_intake: protocol?.dosage_per_intake ?? initialValues?.dosage_per_intake ?? '',
  target_dosage: protocol?.target_dosage ?? initialValues?.target_dosage ?? '',
  titration_status: protocol?.titration_status || initialValues?.titration_status || 'estável',
  titration_schedule: protocol?.titration_schedule || initialValues?.titration_schedule || [],
  notes: protocol?.notes || initialValues?.notes || '',
  active:
    protocol?.active !== undefined
      ? protocol.active
      : initialValues?.active !== undefined
        ? initialValues.active
        : true,
  start_date: protocol?.start_date || initialValues?.start_date || getTodayDateString(),
  end_date: protocol?.end_date || initialValues?.end_date || '',
})

export const getTitrationInitialDosage = (formData) => {
  if (formData.titration_schedule?.length > 0) {
    const firstStage = formData.titration_schedule[0]
    if (firstStage.dosage) return firstStage.dosage
  }
  return ''
}

// eslint-disable-next-line complexity
export const validateProtocolForm = (formData, setErrors, setShakeFields) => {
  const newErrors = {}

  if (!formData.medicine_id) newErrors.medicine_id = 'Selecione um medicamento'
  if (!formData.name.trim()) newErrors.name = 'Nome do tratamento é obrigatório'
  if (!formData.frequency.trim()) newErrors.frequency = 'Frequência é obrigatória'
  if (formData.time_schedule.length === 0) newErrors.time_schedule = 'Adicione pelo menos um horário'
  if (!formData.dosage_per_intake || formData.dosage_per_intake <= 0 || formData.dosage_per_intake > 100) {
    newErrors.dosage_per_intake = 'Dosagem deve estar entre 0.1 e 100'
  }
  if (formData.target_dosage && isNaN(formData.target_dosage)) {
    newErrors.target_dosage = 'Deve ser um número'
  }

  setErrors(newErrors)

  if (Object.keys(newErrors).length > 0) {
    const fieldsWithError = Object.keys(newErrors)
    setShakeFields(fieldsWithError.reduce((acc, field) => ({ ...acc, [field]: true }), {}))
    setTimeout(() => setShakeFields({}), 500)
  }

  return Object.keys(newErrors).length === 0
}

export const prepareDataToSave = (formData, enableTitration) => {
  const isTitrating = enableTitration && formData.titration_schedule.length > 0

  return {
    medicine_id: formData.medicine_id,
    treatment_plan_id: formData.treatment_plan_id || null,
    name: formData.name.trim(),
    frequency: formData.frequency.trim(),
    time_schedule: formData.time_schedule,
    dosage_per_intake: parseFloat(formData.dosage_per_intake),
    target_dosage: (formData.target_dosage ?? '') !== '' ? parseFloat(formData.target_dosage) : null,
    titration_status: isTitrating ? 'titulando' : formData.titration_status,
    titration_schedule: isTitrating ? formData.titration_schedule : [],
    notes: formData.notes.trim() || null,
    active: formData.active,
    start_date: formData.start_date || null,
    end_date: formData.end_date || null,
  }
}

export const handleAddTime = (timeInput, formData, setFormData, setErrors, setTimeInput) => {
  if (!timeInput) return

  if (formData.time_schedule.includes(timeInput)) {
    setErrors((prev) => ({ ...prev, time_schedule: 'Horário já adicionado' }))
    return
  }

  setFormData((prev) => ({
    ...prev,
    time_schedule: [...prev.time_schedule, timeInput].sort(),
  }))
  setTimeInput('')
  setErrors((prev) => {
    const newErrors = { ...prev }
    delete newErrors.time_schedule
    return newErrors
  })
}

export const handleRemoveTime = (time, setFormData) => {
  setFormData((prev) => ({
    ...prev,
    time_schedule: prev.time_schedule.filter((t) => t !== time),
  }))
}
