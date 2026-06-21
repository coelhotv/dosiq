import { useState, useEffect, useCallback, startTransition } from 'react'
import { isInjectable } from '@dosiq/core'
import { logService } from '@shared/services/api/logService'
import { validateLogForm, buildLogPayloads, getInitialFormData } from './_logFormUtils.js'

// Busca o último sítio de injeção global (auxílio de rotação). Falha é silenciosa —
// é apenas dica de UX, nunca bloqueia o registro da dose (031/US2).
function useLastInjectionSite(injectable) {
  const [lastInjectionSite, setLastInjectionSite] = useState(null)
  useEffect(() => {
    if (!injectable) return undefined
    let active = true
    logService
      .getLastInjectionSite()
      .then((site) => active && setLastInjectionSite(site))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [injectable])
  return lastInjectionSite
}

export function useLogFormState({ protocols, treatmentPlans, initialValues, onSave }) {
  const [formData, setFormData] = useState(() => getInitialFormData(initialValues, protocols))

  const [selectedPlanProtocols, setSelectedPlanProtocols] = useState([])
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedProtocol = protocols.find((p) => p.id === formData.protocol_id)
  const selectedPlan = treatmentPlans?.find((p) => p.id === formData.treatment_plan_id)

  // 031: sítio de injeção só p/ medicamento injetável em modo single-protocol.
  const injectable = formData.type === 'protocol' && isInjectable(selectedProtocol?.medicine)

  // Último sítio aplicado (GLOBAL) — exibido no form como auxílio de rotação (US2/US3).
  const lastInjectionSite = useLastInjectionSite(injectable)

  // Atualizar formData quando initialValues mudar (Deep Linking Interno)
  useEffect(() => {
    if (initialValues) {
      startTransition(() => {
        setFormData(getInitialFormData(initialValues, protocols))
      })
    }
  }, [initialValues, protocols])

  // Auto-select all protocols quando um plano é selecionado
  useEffect(() => {
    if (formData.type === 'plan' && formData.treatment_plan_id) {
      const plan = treatmentPlans?.find((p) => p.id === formData.treatment_plan_id)
      if (plan) {
        const activeIds = plan.protocols?.filter((p) => p.active).map((p) => p.id) || []
        startTransition(() => {
          setSelectedPlanProtocols((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(activeIds)) return prev
            return activeIds
          })
        })
      }
    } else {
      startTransition(() => {
        setSelectedPlanProtocols((prev) => (prev.length > 0 ? [] : prev))
      })
    }
  }, [formData.treatment_plan_id, formData.type, treatmentPlans])

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target
      setFormData((prev) => ({ ...prev, [name]: value }))
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: '' }))
      }
    },
    [errors]
  )

  const toggleProtocol = useCallback(
    (protocolId) => {
      setSelectedPlanProtocols((prev) => {
        if (prev.includes(protocolId)) {
          return prev.filter((id) => id !== protocolId)
        } else {
          return [...prev, protocolId]
        }
      })

      if (errors.submit) {
        setErrors((prev) => ({ ...prev, submit: '' }))
      }
    },
    [errors.submit]
  )

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()

      if (!validateLogForm(formData, selectedPlanProtocols, setErrors)) return

      setIsSubmitting(true)

      try {
        const payloads = buildLogPayloads(
          formData,
          protocols,
          treatmentPlans,
          selectedPlanProtocols
        )
        await onSave(payloads)
      } catch (error) {
        console.error('Erro ao registrar medicamento:', error)
        const errorMessage = error?.message || 'Erro desconhecido ao registrar medicamento'
        setErrors({ submit: errorMessage })
      } finally {
        setIsSubmitting(false)
      }
    },
    [formData, selectedPlanProtocols, protocols, treatmentPlans, onSave]
  )

  return {
    formData,
    setFormData,
    errors,
    isSubmitting,
    selectedProtocol,
    selectedPlan,
    selectedPlanProtocols,
    injectable,
    lastInjectionSite,
    handleChange,
    toggleProtocol,
    handleSubmit,
  }
}

