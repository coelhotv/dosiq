import { getTodayDateString } from '@schemas/protocolSchema'

function _getMedicineId(protocol, initialValues, preselectedMedicine) {
  return protocol?.medicine_id || initialValues?.medicine_id || preselectedMedicine?.id || ''
}

function _getTreatmentPlanId(protocol, initialValues) {
  return protocol?.treatment_plan_id || initialValues?.treatment_plan_id || ''
}

function _getName(protocol, initialValues, preselectedMedicine, isSimpleMode) {
  return (
    protocol?.name ||
    initialValues?.name ||
    (isSimpleMode && preselectedMedicine ? `${preselectedMedicine.name} - Tratamento` : '')
  )
}

function _getActive(protocol, initialValues) {
  if (protocol?.active !== undefined) return protocol.active
  if (initialValues?.active !== undefined) return initialValues.active
  return true
}

function _getFrequency(protocol, initialValues) {
  return protocol?.frequency || initialValues?.frequency || 'diário'
}

function _getTimeSchedule(protocol, initialValues) {
  return protocol?.time_schedule || initialValues?.time_schedule || []
}

function _getDosagePerIntake(protocol, initialValues) {
  return protocol?.dosage_per_intake ?? initialValues?.dosage_per_intake ?? ''
}

function _getTargetDosage(protocol, initialValues) {
  return protocol?.target_dosage ?? initialValues?.target_dosage ?? ''
}

function _getTitrationStatus(protocol, initialValues) {
  return protocol?.titration_status || initialValues?.titration_status || 'estável'
}

function _getTitrationSchedule(protocol, initialValues) {
  return protocol?.titration_schedule || initialValues?.titration_schedule || []
}

function _getNotes(protocol, initialValues) {
  return protocol?.notes || initialValues?.notes || ''
}

function _getStartDate(protocol, initialValues) {
  return protocol?.start_date || initialValues?.start_date || getTodayDateString()
}

function _getEndDate(protocol, initialValues) {
  return protocol?.end_date || initialValues?.end_date || ''
}

export function getInitialFormData(protocol, initialValues, preselectedMedicine, isSimpleMode) {
  return {
    medicine_id: _getMedicineId(protocol, initialValues, preselectedMedicine),
    treatment_plan_id: _getTreatmentPlanId(protocol, initialValues),
    name: _getName(protocol, initialValues, preselectedMedicine, isSimpleMode),
    frequency: _getFrequency(protocol, initialValues),
    time_schedule: _getTimeSchedule(protocol, initialValues),
    dosage_per_intake: _getDosagePerIntake(protocol, initialValues),
    target_dosage: _getTargetDosage(protocol, initialValues),
    titration_status: _getTitrationStatus(protocol, initialValues),
    titration_schedule: _getTitrationSchedule(protocol, initialValues),
    notes: _getNotes(protocol, initialValues),
    active: _getActive(protocol, initialValues),
    start_date: _getStartDate(protocol, initialValues),
    end_date: _getEndDate(protocol, initialValues),
  }
}

export const getTitrationInitialDosage = (formData) => {
  if (formData.titration_schedule?.length > 0) {
    const firstStage = formData.titration_schedule[0]
    if (firstStage.dosage) return firstStage.dosage
  }
  return ''
}

function _validateMedicineId(medicineId, errors) {
  if (!medicineId) errors.medicine_id = 'Selecione um medicamento'
}

function _validateName(name, errors) {
  if (!name.trim()) errors.name = 'Nome do tratamento é obrigatório'
}

function _validateFrequency(frequency, errors) {
  if (!frequency.trim()) errors.frequency = 'Frequência é obrigatória'
}

function _validateTimeSchedule(timeSchedule, errors) {
  if (timeSchedule.length === 0) errors.time_schedule = 'Adicione pelo menos um horário'
}

function _validateDosagePerIntake(dosage, errors) {
  if (dosage === '' || dosage === null || dosage < 0 || dosage > 100) {
    errors.dosage_per_intake = 'Dosagem deve estar entre 0 e 100'
  }
}

function _validateTargetDosage(targetDosage, errors) {
  if (targetDosage && isNaN(targetDosage)) {
    errors.target_dosage = 'Deve ser um número'
  }
}

function _triggerShakeAnimation(newErrors, setShakeFields) {
  if (Object.keys(newErrors).length === 0) return
  const fieldsWithError = Object.keys(newErrors)
  setShakeFields(Object.fromEntries(fieldsWithError.map((field) => [field, true])))
  setTimeout(() => setShakeFields({}), 500)
}

export const validateProtocolForm = (formData, setErrors, setShakeFields) => {
  const newErrors = {}

  _validateMedicineId(formData.medicine_id, newErrors)
  _validateName(formData.name, newErrors)
  _validateFrequency(formData.frequency, newErrors)
  _validateTimeSchedule(formData.time_schedule, newErrors)
  _validateDosagePerIntake(formData.dosage_per_intake, newErrors)
  _validateTargetDosage(formData.target_dosage, newErrors)

  setErrors(newErrors)
  _triggerShakeAnimation(newErrors, setShakeFields)

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
