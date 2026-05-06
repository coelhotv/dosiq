import { useState, useCallback, useEffect } from 'react'
import { formatLocalDate, getNow } from '@utils/dateUtils'
import { toTitleCase, toSentenceCase } from '@utils/stringUtils'
import { treatmentPlanService } from '@protocols/services/treatmentPlanService'

export function useWizardNavigation(initialStep) {
  const [step, setStep] = useState(initialStep)
  const [direction, setDirection] = useState(1)

  const goNext = useCallback(() => {
    setDirection(1)
    setStep((s) => s + 1)
  }, [])

  const goBack = useCallback(() => {
    setDirection(-1)
    setStep((s) => s - 1)
  }, [])

  return { step, direction, setStep, setDirection, goNext, goBack }
}

export function useWizardMedicine(preselectedMedicine) {
  const [medicineMode, setMedicineMode] = useState('new')
  const [selectedExistingMedicine, setSelectedExistingMedicine] = useState(
    preselectedMedicine || null
  )

  const [medicineData, setMedicineData] = useState({
    name: preselectedMedicine?.name || '',
    type: preselectedMedicine?.type || 'medicamento',
    dosage_per_pill: preselectedMedicine?.dosage_per_pill || '',
    dosage_unit: preselectedMedicine?.dosage_unit || 'mg',
    laboratory: preselectedMedicine?.laboratory || '',
    active_ingredient: preselectedMedicine?.active_ingredient || '',
    therapeutic_class: preselectedMedicine?.therapeutic_class || null,
    regulatory_category: preselectedMedicine?.regulatory_category || null,
  })

  const updateMedicine = useCallback((field, value) => {
    setMedicineData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleMedicineSelect = useCallback((medicine) => {
    setMedicineData((prev) => ({
      ...prev,
      name: medicine.name,
      active_ingredient: toTitleCase(medicine.activeIngredient) || '',
      therapeutic_class: toSentenceCase(medicine.therapeuticClass) || null,
      regulatory_category: medicine.regulatoryCategory || null,
      laboratory: medicine.laboratory || '',
    }))
  }, [])

  const handleLaboratorySelect = useCallback((laboratory) => {
    setMedicineData((prev) => ({
      ...prev,
      laboratory: laboratory.laboratory || '',
    }))
  }, [])

  return {
    medicineMode, setMedicineMode,
    selectedExistingMedicine, setSelectedExistingMedicine,
    medicineData, setMedicineData,
    updateMedicine, handleMedicineSelect, handleLaboratorySelect
  }
}

export function useWizardProtocol() {
  const [protocolData, setProtocolData] = useState({
    frequency: 'diário',
    time_schedule: ['08:00'],
    dosage_per_intake: 1,
    start_date: formatLocalDate(getNow()),
  })

  const updateProtocol = useCallback((field, value) => {
    setProtocolData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const addTime = useCallback(() => {
    setProtocolData((prev) => ({
      ...prev,
      time_schedule: [...prev.time_schedule, '12:00'],
    }))
  }, [])

  const removeTime = useCallback((index) => {
    setProtocolData((prev) => ({
      ...prev,
      time_schedule: prev.time_schedule.filter((_, i) => i !== index),
    }))
  }, [])

  const updateTime = useCallback((index, value) => {
    setProtocolData((prev) => ({
      ...prev,
      time_schedule: prev.time_schedule.map((t, i) => (i === index ? value : t)),
    }))
  }, [])

  return {
    protocolData, setProtocolData,
    updateProtocol, addTime, removeTime, updateTime
  }
}

export function useWizardStock() {
  const [stockData, setStockData] = useState({
    quantity: '',
    purchase_date: formatLocalDate(getNow()),
    unit_price: '',
    expiration_date: '',
  })

  const updateStock = useCallback((field, value) => {
    setStockData((prev) => ({ ...prev, [field]: value }))
  }, [])

  return { stockData, setStockData, updateStock }
}

export function useWizardPlan(treatmentPlanId) {
  const [availablePlans, setAvailablePlans] = useState([])
  const [planMode, setPlanMode] = useState(treatmentPlanId ? 'existing' : 'none')
  const [selectedPlanId, setSelectedPlanId] = useState(treatmentPlanId || '')
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanEmoji, setNewPlanEmoji] = useState('📋')

  useEffect(() => {
    treatmentPlanService
      .getAll()
      .then((plans) => setAvailablePlans(plans || []))
      .catch(() => setAvailablePlans([]))
  }, [])

  return {
    availablePlans,
    planMode, setPlanMode,
    selectedPlanId, setSelectedPlanId,
    newPlanName, setNewPlanName,
    newPlanEmoji, setNewPlanEmoji
  }
}
