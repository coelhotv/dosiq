// doseActivityScheduler.js — driver TRIGGER-DRIVEN da superfície de estado contínuo (Spec 039 / F2).
//
// Substitui o driver antigo (JS-interval + flip timer, foreground-only) pelo modelo validado no
// spike: as transições de estado da dose são agendadas como **triggers nativos** (Notifee
// TimestampTrigger + AlarmManager allowWhileIdle → fura Doze) e ENCADEADAS — quando um boundary é
// entregue, o handler (bg/fg) chama `advanceDoseActivity` p/ agendar o seguinte. Assim o card
// transiciona label/cor/cronômetro **com o app fechado** (US2.1).
//
// Restrição Notifee (1 trigger pendente por id): o card tem id fixo (`doseInstanceId`), então só dá
// p/ ter 1 boundary pendente por vez → encadeamento. `armDoseActivity` (re-sync na reabertura)
// exibe o estado atual + agenda o PRÓXIMO boundary; `advanceDoseActivity` (na entrega) agenda o
// seguinte. Tudo self-contained: o payload carrega os campos p/ reconstruir o card sem fetch.

import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native'
import {
  deriveDoseActivityState,
  doseActivityBoundaryTimes,
  DOSE_ACTIVITY_STATES,
  getRawNow,
  parseISO,
} from '@dosiq/core'
import {
  buildSurfaceNotification,
  showDoseActivity,
  endDoseActivity,
  surfaceId,
  DOSE_ACTIVITY_CHANNEL_ID,
  LATE_CHRONO_CAP_MINUTES,
} from './doseActivitySurfaceService'

const numOrNull = (v) => {
  const n = Number(v)
  return v == null || v === '' || Number.isNaN(n) ? null : n
}

/**
 * Reconstrói um DoseItem mínimo a partir do `data` da notificação (advance headless, sem fetch).
 * Campos espelham buildRegistrationData (doseActivitySurfaceService). @private
 */
function reconstructDoseItem(data) {
  return {
    instanceId: data.doseInstanceId,
    scheduledFor: data.scheduledFor,
    toleranceMinutes: numOrNull(data.toleranceMinutes),
    critical: data.isCritical === 'true',
    treatmentPlanId: data.treatmentId || null,
    treatmentPlanName: data.treatmentPlanName || '',
    protocolId: data.protocolId || null,
    medicineId: data.medicineId || null,
    medicineName: data.medicineName || '',
    dosagePerIntake: numOrNull(data.quantityTaken) ?? 1,
    intakeUnit: data.intakeUnit || null,
    dosageUnit: data.dosageUnit || null,
    dosagePerPill: numOrNull(data.dosagePerPill),
    unitsPerMl: numOrNull(data.unitsPerMl),
    scheduledTime: data.scheduledTime || '',
  }
}

/** Payload mínimo que ENCERRA a superfície no boundary `missed` (não dá p/ ter trigger silencioso). */
function buildEndPayload(instanceId) {
  return {
    id: surfaceId(instanceId), // id próprio da superfície (não colide com o alarme)
    title: ' ',
    body: ' ',
    data: { doseInstanceId: String(instanceId), __surfaceEnd: 'true' },
    android: {
      channelId: DOSE_ACTIVITY_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT,
      smallIcon: 'ic_dosiq_mark',
      ongoing: false,
      autoCancel: true,
      timeoutAfter: 1, // some imediato; o handler também cancela via __surfaceEnd
    },
  }
}

/**
 * Todos os boundaries (ms) da dose: os do core (later/upcoming/now/now0/late/missed) + o cap de
 * cronômetro do `late` (presentation-only, mobile). Ordenado asc. @private
 */
function allBoundaryTimes(doseItem) {
  const core = doseActivityBoundaryTimes(doseItem.scheduledFor, doseItem.toleranceMinutes)
  if (core.length === 0) return []
  const ms = parseISO(doseItem.scheduledFor).getTime()
  const lateCap = ms + LATE_CHRONO_CAP_MINUTES * 60000
  // T0 (horário exato) é mantido: a superfície re-exibe "agora" ESTÁTICO p/ PARAR o countdown nativo
  // (que iria negativo, -01:15). NÃO colide com o alarme — desde o fix de id próprio (`:surface`),
  // o alarme fullscreen tem id distinto e dispara no T0 em paralelo (não é sobrescrito).
  // Set: se tolerância == LATE_CHRONO_CAP_MINUTES, lateCap coincide com o boundary missed →
  // dedupe evita trigger redundante no mesmo ms (#908).
  return [...new Set([...core, lateCap])].sort((a, b) => a - b)
}

/**
 * Agenda o PRÓXIMO boundary (> fromMs) como trigger nativo. O payload é o card do estado NAQUELE
 * instante (countdown nativo animando a partir do scheduledFor absoluto). missed → trigger que
 * encerra. @private
 */
async function scheduleNextBoundary(doseItem, fromMs, discreet) {
  const times = allBoundaryTimes(doseItem)
  const next = times.find((t) => t > fromMs)
  if (next == null) return // nada à frente (já passou tudo)

  // `next` é epoch ms (numérico, sem ambiguidade de tz — R-020 visa strings 'YYYY-MM-DD').
  // eslint-disable-next-line no-restricted-syntax
  const at = new Date(next)
  const act = deriveDoseActivityState(doseItem, at)
  // Boundary terminal (missed) ou sem estado → encerra a superfície nesse instante.
  if (!act || act.state === DOSE_ACTIVITY_STATES.MISSED || act.state === DOSE_ACTIVITY_STATES.DONE) {
    await notifee.createTriggerNotification(buildEndPayload(doseItem.instanceId), {
      type: TriggerType.TIMESTAMP,
      timestamp: next,
      alarmManager: { allowWhileIdle: true },
    })
    return
  }
  const payload = buildSurfaceNotification(act, { now: at, discreet, doseItem })
  await notifee.createTriggerNotification(payload, {
    type: TriggerType.TIMESTAMP,
    timestamp: next,
    alarmManager: { allowWhileIdle: true }, // fura Doze
  })
}

/**
 * (Re)arma a superfície de uma dose: exibe o estado ATUAL + agenda o próximo boundary. Idempotente
 * (re-sync na reabertura: cancela o pendente antigo via novo agendamento de mesmo id). Terminal
 * (done/missed) → encerra. @param {object} activity - DoseActivityState atual (selectActiveDoseActivity)
 */
export async function armDoseActivity(activity, doseItem, { now = getRawNow(), discreet = false } = {}) {
  if (!activity || !activity.instanceId || !doseItem) return
  if (activity.state === DOSE_ACTIVITY_STATES.DONE || activity.state === DOSE_ACTIVITY_STATES.MISSED) {
    await endDoseActivity(activity.instanceId)
    return
  }
  await showDoseActivity(activity, { now, discreet, doseItem }) // estado atual já
  await scheduleNextBoundary(doseItem, now.getTime(), discreet) // próximo boundary (encadeia daí)
}

/**
 * Avança a cadeia quando um boundary é ENTREGUE (chamado pelos handlers bg/fg). O boundary já
 * EXIBIU o estado novo (trigger), aqui só agendamos o seguinte. Self-contained (rebuild do data).
 * @param {object} data - data da notificação de superfície entregue (__surface)
 */
export async function advanceDoseActivity(data, now = getRawNow()) {
  if (!data || data.__surface !== 'true' || !data.doseInstanceId) return
  const doseItem = reconstructDoseItem(data)
  if (!doseItem.scheduledFor) return
  await scheduleNextBoundary(doseItem, now.getTime(), data.discreet === 'true')
}

/**
 * Reconcilia a superfície a partir do `data` de um ALARME entregue/acionado (não-superfície). O
 * alarme é o "marca-passo" confiável: seu DELIVERED/ACTION é tratado pelo bg handler do index.js
 * (registrado antes do mount). No T0 o fullScreenAction traz a app a foreground e a race pode dropar
 * o DELIVERED do boundary `:surface` → a cadeia trava. Re-armar aqui (re-exibe estado atual + re-agenda
 * próximo boundary, idempotente por id) mantém a máquina viva atravessando T0 e a soneca (T0+5).
 * Só dose crítica single (superfície não cobre alarme agrupado). @param {object} data - data do alarme
 */
export async function reconcileDoseActivityFromAlarm(data, now = getRawNow()) {
  if (!data || !data.doseInstanceId) return
  if (data.isGrouped === 'true') return // superfície é por-dose; alarme agrupado não mapeia 1:1
  if (data.isCritical !== 'true' && data.isCritical !== true) return // superfície só p/ crítica
  const doseItem = reconstructDoseItem(data)
  if (!doseItem.scheduledFor) return
  const activity = deriveDoseActivityState(doseItem, now)
  await armDoseActivity(activity, doseItem, { now, discreet: data.discreet === 'true' })
}
