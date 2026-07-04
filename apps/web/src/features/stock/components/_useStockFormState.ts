import { useState } from 'react'
import { getInitialFormData, validateStockForm, buildStockPayload } from './_stockFormUtils'

export function useStockFormState({ medicines, initialValues, onSave }: any) {
  const [formData, setFormData] = useState<any>(() => getInitialFormData(initialValues))
  const [errors, setErrors] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: any) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const selectedMedicine =
    medicines?.find((medicine) => medicine.id === formData.medicine_id) || null
  const isLiquid = Boolean(selectedMedicine?.dosage_unit?.endsWith('/ml'))
  // 012 Fase B4 (ADR-068): apresentação é atributo do LOTE → pergunta em TODA compra
  // de injetável (paciente pode trocar caneta↔refil entre lotes). Grava no lote.
  const isInjectable = selectedMedicine?.presentation === 'injetavel'
  const needsContainer = isInjectable
  const regulatoryCategory = selectedMedicine?.regulatory_category || null
  const shouldAskPurchaseLaboratory = regulatoryCategory === 'Genérico'
  const fixedLaboratory = regulatoryCategory && regulatoryCategory !== 'Genérico'
  const effectiveLaboratory = shouldAskPurchaseLaboratory
    ? formData.laboratory?.trim() || null
    : selectedMedicine?.laboratory || null

  const validate = () => {
    const newErrors = validateStockForm(formData, isLiquid)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      // ADR-068: container vai no payload do LOTE (buildStockPayload), gravado pela
      // RPC create_purchase_with_stock em stock+purchases. Sem update no medicine.
      await onSave(buildStockPayload(formData, effectiveLaboratory, isLiquid, isInjectable))
    } catch (error) {
      console.error('Erro ao salvar:', error)
      setErrors({ submit: (error as any).message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    formData,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    shouldAskPurchaseLaboratory,
    fixedLaboratory,
    effectiveLaboratory,
    regulatoryCategory,
    isLiquid,
    needsContainer,
  }
}
