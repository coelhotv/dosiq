import { parseLocalDatetime, getNow, parseISO } from '@utils/dateUtils.js'

// Helper to format date to local ISO string (YYYY-MM-DDTHH:mm) for datetime-local input
export const toLocalISO = (dateStr) => {
  const date = dateStr ? parseISO(dateStr) : getNow()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const mins = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${mins}`
}

export const getInitialFormData = (initialValues = {}, protocols = []) => {
  const {
    type,
    protocol_id,
    treatment_plan_id,
    id,
    taken_at,
    quantity_taken,
    notes,
  } = initialValues || {}

  let finalType = type
  if (!finalType) {
    if (protocol_id) {
      finalType = 'protocol'
    } else if (treatment_plan_id) {
      finalType = 'plan'
    } else {
      finalType = 'protocol'
    }
  }

  return {
    type: finalType,
    id: id || null, // For editing
    protocol_id: protocol_id || (protocols.length > 0 ? protocols[0].id : ''),
    treatment_plan_id: treatment_plan_id || '',
    taken_at: toLocalISO(taken_at),
    quantity_taken: quantity_taken || '',
    notes: notes || '',
  }
}

export const validateLogForm = (formData, selectedPlanProtocols, setErrors) => {
  const newErrors = {}

  if (formData.type === 'protocol') {
    if (!formData.protocol_id) {
      newErrors.protocol_id = 'Selecione um protocolo'
    } else if (parseFloat(String(formData.quantity_taken).replace(',', '.')) > 100) {
      newErrors.quantity_taken = 'A quantidade não pode exceder 100 unidades'
    }
  }

  if (formData.type === 'plan') {
    if (!formData.treatment_plan_id) {
      newErrors.treatment_plan_id = 'Selecione um plano'
    } else if (selectedPlanProtocols.length === 0) {
      newErrors.submit = 'Selecione pelo menos um medicamento para registrar'
    }
  }

  setErrors(newErrors)
  return Object.keys(newErrors).length === 0
}

export const buildLogPayloads = (formData, protocols, treatmentPlans, selectedPlanProtocols) => {
  if (formData.type === 'protocol') {
    const protocol = protocols.find((p) => p.id === formData.protocol_id)
    if (!protocol) {
      throw new Error('Protocolo não encontrado')
    }

    const dataToSave = {
      protocol_id: formData.protocol_id,
      medicine_id: protocol.medicine_id,
      quantity_taken: (formData.quantity_taken ?? '') !== ''
        ? parseFloat(String(formData.quantity_taken).replace(',', '.'))
        : protocol.dosage_per_intake,
      taken_at: parseLocalDatetime(formData.taken_at).toISOString(),
      notes: formData.notes.trim() || null,
    }

    if (formData.id) {
      return { ...dataToSave, id: formData.id }
    }
    return dataToSave
  } else {
    // Plan bulk log
    const plan = treatmentPlans?.find((p) => p.id === formData.treatment_plan_id)
    if (!plan) {
      throw new Error('Plano não encontrado')
    }

    // Filter only selected protocols
    const protocolsToLog =
      plan.protocols?.filter((p) => p.active && selectedPlanProtocols.includes(p.id)) || []

    if (protocolsToLog.length === 0) {
      throw new Error('Nenhum protocolo selecionado')
    }

    return protocolsToLog.map((p) => ({
      protocol_id: p.id,
      medicine_id: p.medicine_id,
      quantity_taken: p.dosage_per_intake,
      taken_at: parseLocalDatetime(formData.taken_at).toISOString(),
      notes: formData.notes.trim()
        ? `[Plano: ${plan.name}] ${formData.notes.trim()}`
        : `[Plano: ${plan.name}]`,
    }))
  }
}
