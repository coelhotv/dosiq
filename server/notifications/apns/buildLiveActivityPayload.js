// Spec 041 — Monta attributes + content-state do push-to-start a partir de uma dose_instance.
//
// Casa o struct DoseActivityAttributes.swift (app↔widget). Reusa deriveDoseActivityState (CON-029)
// p/ o estado inicial — recomputado NO INSTANTE do disparo (NC-1): a dose pode ter sido criada/
// editada após o agendamento, então a LA nasce no estado certo (later/upcoming/now/late).
//
// Modo EXPLÍCITO por padrão (decisão PO 2026-06-29): o iOS NÃO redige a Live Activity pela config de
// privacidade do SO (diferente de uma notificação), então "esconder o nome" resultaria só num rótulo
// genérico inútil ("Hora da dose") sem dizer QUAL dose. A LA da 039/foreground já mostra o nome
// (liveActivityService.toParams discreet:false) → o push DEVE ter paridade, senão a LA iniciada/
// transicionada por push aparece discreta e a da tela aberta explícita. "Ocultar nome" vira toggle
// próprio do dosiq (backlog LGPD, CON-030) — não default. (Supersede o S-3 "discreto server-side".)

import { deriveDoseActivityState, doseActivityBoundaryTimes } from '@dosiq/core'
import { parseISO } from '../../utils/dateUtils.js'

/**
 * @param {object} doseItem - shape CON-029 (scheduledFor/scheduled_for, critical_alarm, medicineName, ...)
 * @param {object} [opts]
 * @param {boolean} [opts.discreet=false] - oculta nome (default false: iOS não redige a LA — ver topo)
 * @param {Date|number} [opts.now]
 * @returns {{ attributes: object, contentState: object, staleEpochSec: number }|null} null se não elegível
 */
export function buildLiveActivityStartPayload(doseItem, { discreet = false, now } = {}) {
  const derived = deriveDoseActivityState(doseItem, now)
  if (!derived) return null // instante inválido / distante demais → sem superfície

  // R-020: parseISO (timestamptz absoluto), nunca Date.parse/new Date crus. Fallback usa o `now`
  // injetado (determinístico em teste) — não Date.now() direto.
  const scheduledDate = derived.scheduledFor ? parseISO(derived.scheduledFor) : null
  const scheduledMs = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.getTime() : NaN
  const nowMs = now == null ? Date.now() : (now instanceof Date ? now.getTime() : now)
  const scheduledEpochSec = Number.isNaN(scheduledMs) ? Math.floor(nowMs / 1000) : Math.floor(scheduledMs / 1000)

  // Attributes — explícito por padrão (mostra nome). scheduledTime é só rótulo HH:mm.
  const medicineName = derived.medicineLabel || doseItem.medicineName || 'Dose'
  const attributes = {
    medicineName: discreet ? '' : medicineName,
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

  // staleDate = PRÓXIMO boundary de estado (não +1h fixo). Quando ele passa, o iOS re-renderiza a LA
  // e o widget recomputa displayState (ex.: now→late) — SEM token per-Activity e SEM app aberto. É a
  // única transição garantida no caso app-fechado (o token de update só é emitido ao app rodando —
  // limitação do ActivityKit). Espelha liveActivityService.toParams (foreground). Fallback +1h.
  const boundaries = derived.scheduledFor ? doseActivityBoundaryTimes(derived.scheduledFor) : []
  const nextBoundaryMs = boundaries.find((b) => b > nowMs) ?? null
  const staleEpochSec = nextBoundaryMs != null ? Math.floor(nextBoundaryMs / 1000) : scheduledEpochSec + 3600

  return { attributes, contentState, staleEpochSec }
}
