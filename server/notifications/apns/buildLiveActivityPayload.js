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
import { parseISO } from '../../utils/dateUtils'

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

  // staleDate — o ActivityKit dá UMA só transição em background por push (app fechado): o SO
  // re-renderiza a LA quando o staleDate passa e o widget recomputa displayState, SEM token nem app
  // aberto. Gastamos essa transição no boundary que MAIS importa (ADR-076 / decisão 2026-07-02):
  //   • estado 'upcoming'/'now' no disparo → alvo = '→ late'. 'now' é cosmético (o timer do 'upcoming'
  //     já mostra "agora" ao cruzar T0; o push time-sensitive + alarme fullscreen são donos do T0).
  //     O que importa app-fechado é virar 'late' se o usuário não agir.
  //   • estado 'later' (sem countdown) → alvo = '→ upcoming' (mostrar o countdown vale mais que o late).
  // Fallback +1h se não houver boundary futuro (ex.: já em 'late').
  const boundaries = derived.scheduledFor ? doseActivityBoundaryTimes(derived.scheduledFor) : []
  let targetMs = null
  for (const b of boundaries) {
    if (b <= nowMs) continue
    // b é epoch ms (numérico, sem ambiguidade de tz — R-020 visa new Date('YYYY-MM-DD') strings).
    // eslint-disable-next-line no-restricted-syntax
    const st = deriveDoseActivityState(doseItem, new Date(b + 1000))?.state
    if (derived.state === 'later' && st === 'upcoming') { targetMs = b; break }
    if (st === 'late') { targetMs = b; break }
  }
  const staleEpochSec = targetMs != null ? Math.floor(targetMs / 1000) : scheduledEpochSec + 3600

  return { attributes, contentState, staleEpochSec }
}
