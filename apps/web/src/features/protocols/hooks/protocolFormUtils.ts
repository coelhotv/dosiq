import { getTodayDateString } from '@schemas/protocolSchema'
import { getProtocolDays } from '@utils/adherenceLogic'
import { coerceDecimal } from '@dosiq/core'

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
    intake_unit: protocol?.intake_unit ?? initialValues?.intake_unit ?? null,
    // Densidade do medicamento (gotas/UI por ml) — editável aqui (022 Fase C), grava no medicine.
    units_per_ml: protocol?.medicine?.units_per_ml ?? preselectedMedicine?.units_per_ml ?? '',
    target_dosage: _getTargetDosage(protocol, initialValues),
    titration_status: _getTitrationStatus(protocol, initialValues),
    titration_schedule: _getTitrationSchedule(protocol, initialValues),
    notes: _getNotes(protocol, initialValues),
    active: _getActive(protocol, initialValues),
    start_date: _getStartDate(protocol, initialValues),
    end_date: _getEndDate(protocol, initialValues),
    weekdays: (() => {
      const days = getProtocolDays(protocol)
      return days.length > 0 ? days : (initialValues?.weekdays || [])
    })(),
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
  // Cap 1000 (Fase B): líquidos podem ter doses maiores em gotas/ml/UI.
  // Normaliza vírgula→ponto antes de comparar (R-270): "2,5" não pode falhar.
  const n = coerceDecimal(dosage)
  if (dosage === '' || dosage === null || Number.isNaN(n) || n <= 0 || n > 1000) {
    errors.dosage_per_intake = 'Dosagem deve ser maior que 0 e até 1000'
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
  const newErrors: any = {}

  _validateMedicineId(formData.medicine_id, newErrors)
  _validateName(formData.name, newErrors)
  _validateFrequency(formData.frequency, newErrors)
  _validateTimeSchedule(formData.time_schedule, newErrors)
  _validateDosagePerIntake(formData.dosage_per_intake, newErrors)
  _validateTargetDosage(formData.target_dosage, newErrors)

  if (formData.frequency === 'semanal' || formData.frequency === 'personalizado') {
    if (!formData.weekdays || !Array.isArray(formData.weekdays) || formData.weekdays.length === 0) {
      newErrors.weekdays = 'Selecione pelo menos um dia da semana'
    }
  }

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
    dosage_per_intake: coerceDecimal(formData.dosage_per_intake),
    intake_unit: formData.intake_unit || null,
    target_dosage: (formData.target_dosage ?? '') !== '' ? coerceDecimal(formData.target_dosage) : null,
    titration_status: isTitrating ? 'titulando' : formData.titration_status,
    // R-270 (012 Fase B): wizard mantém o texto cru durante a digitação ("0,5");
    // normaliza vírgula→ponto e força number aqui — o banco nunca vê string.
    titration_schedule: isTitrating
      ? formData.titration_schedule.map((stage) => ({
          // Shape canônico do Zod (titrationStageSchema): duration_days/description.
          // Migra registros legados days/note na gravação.
          duration_days: parseInt(stage.duration_days ?? stage.days, 10) || 1,
          dosage: coerceDecimal(stage.dosage) || 0,
          ...((stage.description ?? stage.note) ? { description: stage.description ?? stage.note } : {}),
          // FR-021 (012 Fase B2): só persiste a flag quando marcada (etapa cross-medicamento).
          ...(stage.requires_new_medicine ? { requires_new_medicine: true } : {}),
        }))
      : [],
    notes: formData.notes.trim() || null,
    active: formData.active,
    start_date: formData.start_date || null,
    end_date: formData.end_date || null,
    weekdays: (formData.frequency === 'semanal' || formData.frequency === 'personalizado') ? formData.weekdays : [],
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
