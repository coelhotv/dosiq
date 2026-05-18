// useProtocolFormSubmit.js — handler de submit do ProtocolFormScreen.
//
// Encapsula:
// - Coerce de dose (string "0,5" / "0.5" / intermediário) → number
// - Validate Zod com refinements cross-campo (AP-156)
// - Plano inline: cria via treatmentPlanService.create ANTES do tratamento
// - Roteamento create vs update por presença de editId

import { useCallback, useState } from 'react'
import { treatmentPlanService } from '../services/treatmentPlanService'

function coerceDose(form) {
  const raw = form.values.dosage_per_intake
  if (typeof raw !== 'string' || raw === '') return raw
  const normalized = raw.replace(',', '.')
  const num = Number(normalized)
  if (!Number.isFinite(num)) return raw
  form.handleChange('dosage_per_intake', num)
  return num
}

async function resolveInlinePlan(planField, show) {
  if (planField.mode !== 'inline') return { ok: true, planId: null, useInline: false }
  const planName = planField.inline?.name?.trim()
  if (!planName) {
    show('Informe o nome do novo plano', { variant: 'error' })
    return { ok: false, planId: null, useInline: true }
  }
  const created = await treatmentPlanService.create({
    name: planName,
    color: planField.inline.color,
    emoji: planField.inline.emoji,
  })
  return { ok: true, planId: created?.id ?? null, useInline: true }
}

export function useProtocolFormSubmit({ editId, form, planField, mutation, show, onValidateFail }) {
  // States
  const [submitting, setSubmitting] = useState(false)

  // Handlers
  const submit = useCallback(async () => {
    if (submitting) return
    const currentDose = coerceDose(form)

    // Override em validate evita race com handleChange assíncrono que coerceDose
    // dispara — validate lê state da frame anterior; passamos o valor já coercido
    // explicitamente pra schema parse.
    const ok = form.validate({ dosage_per_intake: currentDose })
    if (!ok) {
      show('Verifique os campos destacados', { variant: 'error' })
      onValidateFail?.()
      return
    }

    setSubmitting(true)
    try {
      const resolved = await resolveInlinePlan(planField, show)
      if (!resolved.ok) {
        setSubmitting(false)
        return
      }
      const planId = resolved.useInline
        ? resolved.planId
        : (form.values.treatment_plan_id || null)

      const payload = {
        ...form.values,
        dosage_per_intake: currentDose,
        treatment_plan_id: planId,
      }

      const result = editId
        ? await mutation.update(editId, payload, { goBack: true })
        : await mutation.create(payload, { goBack: true })

      if (!result) setSubmitting(false)
    } catch (err) {
      setSubmitting(false)
      const verb = editId ? 'atualizar' : 'criar'
      show(err?.message ?? `Erro ao ${verb} tratamento`, { variant: 'error' })
    }
  }, [editId, form, planField, mutation, show, submitting, onValidateFail])

  return { submit, submitting }
}
