// Spec 041 — Monta attributes + content-state do push-to-start a partir de uma dose_instance.
//
// Casa o struct DoseActivityAttributes.swift (app↔widget). Reusa deriveDoseActivityState (CON-029)
// p/ o estado inicial — recomputado NO INSTANTE do disparo (NC-1): a dose pode ter sido criada/
// editada após o agendamento, então a LA nasce no estado certo (later/upcoming/now/late).
//
// S-3 (PO-SEC-2): em modo discreto (toda dose crítica, paridade 039), o nome do medicamento NÃO
// entra no payload — o dado não pode sair do servidor, não basta ocultar no widget.

import { deriveDoseActivityState } from '@dosiq/core'

/**
 * @param {object} doseItem - shape CON-029 (scheduledFor/scheduled_for, critical_alarm, medicineName, ...)
 * @param {object} [opts]
 * @param {boolean} [opts.discreet=true] - oculta nome (default true: superfície é critical-only)
 * @param {Date|number} [opts.now]
 * @returns {{ attributes: object, contentState: object, staleEpochSec: number }|null} null se não elegível
 */
export function buildLiveActivityStartPayload(doseItem, { discreet = true, now } = {}) {
  const derived = deriveDoseActivityState(doseItem, now)
  if (!derived) return null // instante inválido / distante demais → sem superfície

  const scheduledMs = derived.scheduledFor ? Date.parse(derived.scheduledFor) : NaN
  const scheduledEpochSec = Number.isNaN(scheduledMs) ? Math.floor(Date.now() / 1000) : Math.floor(scheduledMs / 1000)

  // Attributes — discreto omite nome/dose (S-3). scheduledTime é só rótulo HH:mm (não-PII).
  const attributes = {
    medicineName: discreet ? '' : (derived.medicineLabel || ''),
    doseLabel: discreet ? '' : (doseItem.doseLabel || ''),
    scheduledTime: doseItem.scheduledTime || '',
    discreet,
    instanceId: String(derived.instanceId ?? ''),
    treatmentId: String(derived.treatmentId ?? ''),
    groupSize: doseItem.groupSize ?? 1,
  }

  // ContentState — casa DoseActivityAttributes.ContentState (state, scheduledAt, doneAtLabel).
  // ⚠️ scheduledAt em epoch SEGUNDOS: a estratégia de decode de Date do widget DEVE bater
  // (validação MANUAL em device — PO-1/PO-2). doneAtLabel vazio no start.
  const contentState = {
    state: derived.state,
    scheduledAt: scheduledEpochSec,
    doneAtLabel: '',
  }

  return { attributes, contentState, staleEpochSec: scheduledEpochSec + 3600 }
}
