import { useState, useCallback } from 'react'
import { formatLocalDate, getNow } from '@utils/dateUtils'
import { coerceDecimal } from '@dosiq/core'
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
  // Sempre inicia no passo 1: medicamentos vindos da busca ANVISA (preselectedMedicine)
  // são novos (não estão na tabela medicines) e precisam dos campos do passo 1 —
  // concentração, unidade de dosagem, forma de apresentação e TTL (injetáveis) — que
  // a base ANVISA não fornece. Os dados ANVISA entram pré-preenchidos via useWizardMedicine.
  const nav = useWizardNavigation(1)
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

  const isMedicineValid =
    med.medicineMode === 'existing'
      ? !!med.selectedExistingMedicine
      : med.medicineData.name.length >= 2 && coerceDecimal(med.medicineData.dosage_per_pill) > 0
  // FR-018 (012 Fase B2): dose em mg (GLP-1) exige a concentração mg/ml do
  // medicamento (dosage_per_pill) — sem ela não há como converter mg→ml no estoque.
  // A concentração vem do cadastro do medicamento, não do tratamento.
  const selectedMed =
    med.medicineMode === 'existing' ? med.selectedExistingMedicine : med.medicineData
  const mgNeedsConcentration =
    prot.protocolData.intake_unit === 'mg' && !(coerceDecimal(selectedMed?.dosage_per_pill) > 0)
  const dosePerIntake = coerceDecimal(prot.protocolData.dosage_per_intake)
  const isProtocolValid =
    prot.protocolData.time_schedule.length > 0 &&
    dosePerIntake > 0 &&
    dosePerIntake <= 100 &&
    !mgNeedsConcentration &&
    (!['semanal', 'personalizado'].includes(prot.protocolData.frequency) ||
      (Array.isArray(prot.protocolData.weekdays) && prot.protocolData.weekdays.length > 0))

  const resetWizard = useCallback(() => {
    nav.setStep(1)
    setResult(null)
    med.setMedicineData({
      name: '',
      type: 'medicamento',
      dosage_per_pill: '',
      dosage_unit: 'mg',
      units_per_ml: '',
      presentation: 'comprimido',
      shelf_life_days: '',
      laboratory: '',
      active_ingredient: '',
      therapeutic_class: null,
      regulatory_category: null,
    })
    prot.setProtocolData({
      frequency: 'diário',
      time_schedule: ['08:00'],
      dosage_per_intake: 1,
      intake_unit: '',
      units_per_ml: '',
      start_date: formatLocalDate(getNow()),
      weekdays: [],
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
