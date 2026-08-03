// liveActivityService.js — Spec 039 / F3 (iOS Live Activity)
//
// Casca JS do módulo nativo DoseActivityBridge (start/update/end/drainPendingActions). Espelha o
// papel do doseActivitySurfaceService (Android) — apresenta a máquina de estados do core (CON-029)
// na superfície da plataforma. iOS-only: no-op silencioso fora do iOS (guard Platform.OS).
//
// Server-free: a struct nativa renderiza o tempo via Text(timerInterval:) (timer vivo); o JS só
// empurra estado/label/alvo. drainPendingActions traz a fila de ações do App Intent (App Group)
// p/ o RN processar com sessão VIVA (PO-SEC-2).

import { NativeModules, Platform } from 'react-native'
import { parseISO, getRawNow, doseActivityBoundaryTimes, formatDoseItem } from '@dosiq/core'

const native = NativeModules.DoseActivityBridge
const isIOS = Platform.OS === 'ios'
const available = isIOS && !!native

/** HH:mm local de um instante (Hermes ICU-safe, sem Intl — espelha formatClock do Android #898). @private */
function clockLabel(d) {
  const date = d instanceof Date ? d : d ? parseISO(d) : getRawNow()
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Monta os params nativos a partir do DoseActivityState (CON-029) + doseItem. Nome e dose vão
 * SEPARADOS (mock: nome 22pt + subtítulo "dose · HH:mm"). discreet = isCritical (PO-SEC-1 — lock
 * screen oculta o nome; superfície é critical-only). @private
 */
function _getTolerance(doseItem: any): number | null {
  if (!doseItem) return null
  return doseItem.toleranceMinutes ?? doseItem.tolerance_minutes ?? null
}

function _resolveMedicineName(activity: any, doseItem: any, medicineName?: string): string {
  if (medicineName) return medicineName
  if (activity?.medicineLabel) return activity.medicineLabel
  if (doseItem?.medicineName) return doseItem.medicineName
  return 'Dose'
}

function _getStaleDateMs(scheduledFor: string | undefined, tol: number | null, nowMs: number): number | null {
  if (!scheduledFor) return null
  const boundaries = doseActivityBoundaryTimes(scheduledFor, tol)
  return boundaries.find((b) => b > nowMs) ?? null
}

function toParams(activity: any, doseItem: any, medicineName?: string) {
  const nowMs = getRawNow().getTime()
  const scheduledAtMs = doseItem?.scheduledFor ? parseISO(doseItem.scheduledFor).getTime() : nowMs
  const tol = _getTolerance(doseItem)
  const staleDateMs = _getStaleDateMs(doseItem?.scheduledFor, tol, nowMs)
  const name = _resolveMedicineName(activity, doseItem, medicineName)

  return {
    medicineName: name,
    doseLabel: doseItem ? formatDoseItem(doseItem) : '',
    scheduledTime: doseItem?.scheduledTime || '',
    discreet: false,
    instanceId: String(activity.instanceId),
    treatmentId: doseItem?.treatmentPlanId || '',
    groupSize: activity.groupSize || 1,
    state: activity.state,
    scheduledAtMs,
    doneAtLabel: '',
    ...(staleDateMs ? { staleDateMs } : {}),
  }
}

/** Inicia/substitui a Live Activity p/ o estado atual. */
export async function startLiveActivity(activity, doseItem, { medicineLabel }: { medicineLabel?: string } = {}) {
  if (!available || !activity?.instanceId) return null
  try {
    return await native.start(toParams(activity, doseItem, medicineLabel))
  } catch {
    return null // best-effort: LA desabilitada nos Ajustes / iOS < 16.2
  }
}

/** Atualiza o estado da Live Activity ativa (transição sem recriar). */
export async function updateLiveActivity(activity, doseItem, { medicineLabel }: { medicineLabel?: string } = {}) {
  if (!available || !activity?.instanceId) return
  try {
    await native.update(toParams(activity, doseItem, medicineLabel))
  } catch {
    // best-effort
  }
}

/**
 * Card de confirmação `done` (mock): "✓ Tomada às HH:mm · Encerra em breve" por ~3min, depois
 * encerra sozinho (paridade showDoseDone Android). Chamado quando a dose ativa vira `taken`.
 * @param {{ instanceId: string, takenAt?: Date|string }} ctx
 */
export async function showDoneLiveActivity({ instanceId, takenAt }: { instanceId?: string; takenAt?: Date | string } = {}) {
  if (!available || !instanceId) return
  try {
    await native.done({
      instanceId: String(instanceId),
      state: 'done',
      doneAtLabel: clockLabel(takenAt),
      scheduledAtMs: getRawNow().getTime(),
    })
  } catch {
    // best-effort — confirmação não deve quebrar o registro
  }
}

/** Encerra a Live Activity (cancel-on-resolve / PO-3.2). */
export async function endLiveActivity() {
  if (!available) return
  try {
    await native.end()
  } catch {
    // best-effort
  }
}

/** Drena a fila de ações do App Intent (App Group). Retorna [{action,instanceId,treatmentId,ts}]. */
export async function drainPendingActions() {
  if (!available) return []
  try {
    const queue = await native.drainPendingActions()
    return Array.isArray(queue) ? queue : []
  } catch {
    return []
  }
}

/**
 * Spec 041 — token push-to-start do ActivityKit (iOS 17.2+). Inicia o observer nativo (idempotente)
 * e retorna o token hex persistido (ou '' se ainda não emitido pelo SO / iOS < 17.2). O backend usa
 * o token p/ iniciar a Live Activity com o app fechado (ADR-076).
 * @returns {Promise<string>}
 */
export async function getPushToStartToken() {
  if (!available || !native.getPushToStartToken) return ''
  try {
    const token = await native.getPushToStartToken()
    return typeof token === 'string' ? token : ''
  } catch {
    return ''
  }
}

/**
 * Spec 041 fix-up — token push PER-ACTIVITY (ActivityKit `Activity.pushTokenUpdates`, iOS 17.2+) da
 * LA ativa de um instanceId. O backend usa p/ push de update/end (transição de estado + encerramento
 * com app fechado). '' se ainda não emitido pelo SO / iOS < 17.2 / fora do iOS.
 * @param {string} instanceId
 * @returns {Promise<string>}
 */
export async function getActivityPushToken(instanceId) {
  if (!available || !instanceId || !native.getActivityPushToken) return ''
  try {
    const token = await native.getActivityPushToken(String(instanceId))
    return typeof token === 'string' ? token : ''
  } catch {
    return ''
  }
}

export const liveActivitySupported = available
