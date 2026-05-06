import { useState, useCallback } from 'react'
import { formatLocalDate, getNow } from '@utils/dateUtils'
import { submitTreatmentWizard } from './_treatmentWizardSubmit'
import {
  useWizardNavigation,
  useWizardMedicine,
  useWizardProtocol,
  useWizardStock,
  useWizardPlan
} from './_useWizardSections'

export function useTreatmentWizardState({
  preselectedMedicine,
  treatmentPlanId,
  refresh,
}) {
  const nav = useWizardNavigation(preselectedMedicine ? 2 : 1)
  const med = useWizardMedicine(preselectedMedicine)
  const prot = useWizardProtocol()
  const stock = useWizardStock()
  const plan = useWizardPlan(treatmentPlanId)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleComplete = useCallback(
    async (skipStock) => {
      setIsSubmitting(true)
      setError(null)
      try {
        const { medicine, protocol } = await submitTreatmentWizard({
          medicineData: med.medicineData,
          selectedExistingMedicine: med.selectedExistingMedicine,
          protocolData: prot.protocolData,
          stockData: stock.stockData,
          planMode: plan.planMode,
          selectedPlanId: plan.selectedPlanId,
          newPlanName: plan.newPlanName,
          newPlanEmoji: plan.newPlanEmoji,
          step: nav.step,
          skipStock,
        })
        if (refresh) refresh()
        setResult({ medicine, protocol })
        nav.setDirection(1)
        nav.setStep(4)
      } catch (err) {
        setError(err.message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      med.medicineData,
      med.selectedExistingMedicine,
      prot.protocolData,
      stock.stockData,
      plan.planMode,
      plan.selectedPlanId,
      plan.newPlanName,
      plan.newPlanEmoji,
      nav,
      refresh,
    ]
  )

  const isMedicineValid = med.medicineMode === 'existing' ? !!med.selectedExistingMedicine : med.medicineData.name.length >= 2 && med.medicineData.dosage_per_pill > 0
  const isProtocolValid = prot.protocolData.time_schedule.length > 0 && prot.protocolData.dosage_per_intake > 0 && prot.protocolData.dosage_per_intake <= 100

  const resetWizard = useCallback(() => {
    nav.setStep(1)
    setResult(null)
    med.setMedicineData({
      name: '',
      type: 'medicamento',
      dosage_per_pill: '',
      dosage_unit: 'mg',
      laboratory: '',
      active_ingredient: '',
      therapeutic_class: null,
      regulatory_category: null,
    })
    prot.setProtocolData({
      frequency: 'diário',
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      start_date: formatLocalDate(getNow()),
    })
    stock.setStockData({
      quantity: '',
      purchase_date: formatLocalDate(getNow()),
      unit_price: '',
      expiration_date: '',
    })
  }, [nav, med, prot, stock])

  return {
    ...nav,
    ...med,
    ...prot,
    ...stock,
    ...plan,
    isSubmitting,
    error,
    result,
    handleComplete,
    isMedicineValid,
    isProtocolValid,
    resetWizard,
  }
}
