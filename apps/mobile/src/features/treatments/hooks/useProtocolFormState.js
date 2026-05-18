// useProtocolFormState.js — encapsula state do ProtocolFormScreen (Fase 2 T2.7).
//
// Centraliza:
// - form (useFormState com protocolCreateSchema)
// - sidecar UI: medicine, sheetOpen, pendingReopenSheet, plans, planField
// - load assíncrono de planos terapêuticos
// - prefill em modo EDIT (one-shot via guard `prefilled`)
//
// Retorna API plana consumida pelo screen; tudo memoizado/estável.

import { useCallback, useEffect, useState, startTransition } from 'react'
import { useFormState } from '@shared/hooks/useFormState'
import { protocolCreateSchema } from '@dosiq/core'
import { useProtocol } from './useProtocols'
import { treatmentPlanService } from '../services/treatmentPlanService'

export function buildInitialValues({ todayIso, presetPlanId }) {
  return {
    medicine_id: '',
    name: '',
    dosage_per_intake: '',
    frequency: 'diário',
    weekdays: [],
    time_schedule: [],
    start_date: todayIso,
    end_date: null,
    notes: '',
    active: true,
    titration_status: 'estável',
    titration_schedule: [],
    current_stage_index: 0,
    treatment_plan_id: presetPlanId || null,
  }
}

function buildPrefill(existing, todayIso) {
  return {
    medicine_id: existing.medicine_id ?? '',
    name: existing.name ?? '',
    dosage_per_intake: existing.dosage_per_intake ?? '',
    frequency: existing.frequency ?? 'diário',
    weekdays: Array.isArray(existing.weekdays) ? existing.weekdays : [],
    time_schedule: Array.isArray(existing.time_schedule) ? existing.time_schedule : [],
    start_date: existing.start_date ?? todayIso,
    end_date: existing.end_date ?? null,
    notes: existing.notes ?? '',
    active: existing.active ?? true,
    titration_status: existing.titration_status ?? 'estável',
    titration_schedule: existing.titration_schedule ?? [],
    current_stage_index: existing.current_stage_index ?? 0,
    treatment_plan_id: existing.treatment_plan_id ?? null,
  }
}

export function useProtocolFormState({ editId, todayIso, presetPlanId }) {
  // States (R-010 — States → Memos → Effects → Handlers)
  const form = useFormState(protocolCreateSchema, {
    initialValues: buildInitialValues({ todayIso, presetPlanId }),
  })

  const [medicine, setMedicine] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingReopenSheet, setPendingReopenSheet] = useState(false)
  const [plans, setPlans] = useState([])
  const [planField, setPlanField] = useState(() => ({
    mode: 'select',
    planId: presetPlanId || null,
    inline: null,
  }))
  const [prefilled, setPrefilled] = useState(false)

  const { data: existing, loading: existingLoading, error: existingError } = useProtocol(editId)

  // Effects — load planos
  useEffect(() => {
    let cancelled = false
    treatmentPlanService
      .getAll()
      .then((list) => {
        if (!cancelled) startTransition(() => setPlans(Array.isArray(list) ? list : []))
      })
      .catch(() => {
        if (!cancelled) startTransition(() => setPlans([]))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Effects — prefill EDIT (one-shot via guard, startTransition para evitar
  // cascading renders flag do react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!editId || prefilled || !existing) return
    const prefill = buildPrefill(existing, todayIso)
    startTransition(() => {
      form.reset(prefill)
      if (existing.medicine) setMedicine(existing.medicine)
      setPlanField({
        mode: 'select',
        planId: existing.treatment_plan_id ?? null,
        inline: null,
      })
      setPrefilled(true)
    })
  }, [editId, prefilled, existing, todayIso, form])

  // Handlers — wrappers para o screen
  const selectMedicine = useCallback(
    (med) => {
      setMedicine(med)
      form.handleChange('medicine_id', med.id)
    },
    [form]
  )

  const changePlanField = useCallback(
    (next) => {
      setPlanField(next)
      form.handleChange('treatment_plan_id', next.mode === 'select' ? next.planId : null)
    },
    [form]
  )

  return {
    form,
    medicine,
    selectMedicine,
    sheetOpen,
    setSheetOpen,
    pendingReopenSheet,
    setPendingReopenSheet,
    plans,
    planField,
    changePlanField,
    existingLoading: !!editId && existingLoading && !prefilled,
    existingError: !!editId && !!existingError ? existingError : null,
  }
}
