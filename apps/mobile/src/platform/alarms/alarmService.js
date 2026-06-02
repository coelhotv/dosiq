// alarmService.js — orquestra alarmes locais persistentes via Notifee (Spec 001)
//
// Coexiste com expo-notifications (push remoto, push_chime.wav). Este módulo cuida
// SÓ do alarme invasivo local (alarm_dose.wav, canal HIGH, bypass DND, full-screen).
//
// Invariantes:
//  - F: `scheduledFor` é instante absoluto (ISO/timestamptz) → TriggerType.TIMESTAMP
//       usa o instante direto, SEM conversão de timezone no agendamento.
//  - A: notificationId === doseInstanceId → idempotência cross-restart (re-sync
//       re-cria a MESMA id; o SO substitui em vez de duplicar).
//  - D: nag/expiração respeitam `toleranceMinutes` da própria instância (dinâmico),
//       nunca 120 fixo.
//  - cancelAll usa cancelTriggerNotifications() → cancela só triggers do Notifee,
//       NÃO toca as notificações do expo-notifications (push remoto preservado).

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  TriggerType,
} from '@notifee/react-native'
import { Platform } from 'react-native'
import { parseISO } from '@dosiq/core'
import { debugLog } from '@shared/utils/debugLog'

export const ALARM_CHANNEL_ID = 'dose-alarm'
const SOUND_ANDROID = 'alarm_dose' // res/raw/alarm_dose (sem extensão)
const SOUND_IOS = 'alarm_dose.wav'
const NAG_INTERVAL_MS = 5 * 60 * 1000
const MAX_NAG_ATTEMPTS = 3

// Ações da notificação (R-222 — IDs estáveis, sem string solta no caller).
export const ALARM_ACTION = Object.freeze({
  TAKEN: 'dose-taken',
  SKIP: 'dose-skip',
})

let channelEnsured = false

/** Cria (idempotente) o canal Android HIGH que fura DND. No-op no iOS. */
export async function ensureAlarmChannel() {
  if (Platform.OS !== 'android' || channelEnsured) return
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Alarmes de dose',
    importance: AndroidImportance.HIGH,
    sound: SOUND_ANDROID,
    vibration: true,
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  })
  channelEnsured = true
}

// Monta o objeto de notificação compartilhado por agendamento e nag.
function buildNotification({ doseInstanceId, medicineName, data, notificationId }) {
  const title = '💊 Hora da dose'
  const body = medicineName ? `Está na hora de ${medicineName}.` : 'Está na hora da sua dose.'
  return {
    id: notificationId,
    title,
    body,
    data: { ...data, doseInstanceId },
    android: {
      channelId: ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      sound: SOUND_ANDROID,
      // Full-screen intent na lock screen (FR-002).
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Tomei', pressAction: { id: ALARM_ACTION.TAKEN } },
        { title: 'Pular', pressAction: { id: ALARM_ACTION.SKIP } },
      ],
    },
    ios: {
      sound: SOUND_IOS,
      interruptionLevel: 'timeSensitive', // fallback até critical alert entitlement (A2)
      categoryId: ALARM_CHANNEL_ID,
    },
  }
}

/**
 * Agenda o alarme de uma ocorrência. Idempotente por `doseInstanceId` (A).
 * @param {{ doseInstanceId: string, medicineName?: string, scheduledFor: string|number|Date,
 *           toleranceMinutes?: number|null, data?: object }} params
 */
export async function scheduleAlarm({
  doseInstanceId,
  medicineName,
  scheduledFor,
  toleranceMinutes = null,
  data = {},
}) {
  await ensureAlarmChannel()
  // F: instante absoluto (timestamptz) → epoch direto via parseISO (não date-string parse).
  const timestamp = parseISO(scheduledFor).getTime()
  if (Number.isNaN(timestamp)) {
    if (__DEV__) console.warn('[alarmService] scheduledFor inválido:', scheduledFor)
    return
  }
  // Não agendar passado: o gerador não cria pending retroativo; defensivo.
  if (timestamp <= Date.now()) return

  const notification = buildNotification({
    doseInstanceId,
    medicineName,
    notificationId: doseInstanceId,
    data: { ...data, medicineName, toleranceMinutes, nagAttempt: '0' },
  })

  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp,
    alarmManager: { allowWhileIdle: true }, // fura Doze Mode (Android)
  })
  debugLog('[alarmService] agendado', doseInstanceId, 'ts=', timestamp)
}

/** Cancela o alarme principal + nags de uma ocorrência. */
export async function cancelAlarm(doseInstanceId) {
  await notifee.cancelTriggerNotification(doseInstanceId)
  for (let n = 1; n <= MAX_NAG_ATTEMPTS; n++) {
    await notifee.cancelTriggerNotification(`${doseInstanceId}:nag:${n}`)
  }
}

/**
 * Re-agenda um nag +5min se ignorado, máx 3 tentativas, reativamente (FR-003).
 * Respeita a tolerância da instância (D): além da janela, para de insistir.
 * @param {{ doseInstanceId: string, medicineName?: string, scheduledFor?: string|number|Date,
 *           toleranceMinutes?: number|null, currentNagAttempt?: number, data?: object }} params
 */
export async function scheduleNag({
  doseInstanceId,
  medicineName,
  scheduledFor,
  toleranceMinutes = null,
  currentNagAttempt = 0,
  data = {},
}) {
  const next = currentNagAttempt + 1
  if (next > MAX_NAG_ATTEMPTS) return

  const nextTs = Date.now() + NAG_INTERVAL_MS

  // D: se a ocorrência já passou da tolerância, não insistir (vira missed pelo sweep).
  if (scheduledFor != null && toleranceMinutes != null) {
    const cutoff = parseISO(scheduledFor).getTime() + toleranceMinutes * 60 * 1000
    if (!Number.isNaN(cutoff) && nextTs > cutoff) return
  }

  await ensureAlarmChannel()
  const notification = buildNotification({
    doseInstanceId,
    medicineName,
    notificationId: `${doseInstanceId}:nag:${next}`,
    data: { ...data, medicineName, scheduledFor, toleranceMinutes, nagAttempt: String(next) },
  })

  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp: nextTs,
    alarmManager: { allowWhileIdle: true },
  })
  debugLog('[alarmService] nag', next, doseInstanceId)
}

/** Cancela TODOS os triggers do Notifee (não toca expo-notifications). */
export async function cancelAll() {
  await notifee.cancelTriggerNotifications()
  debugLog('[alarmService] cancelAll')
}

export const alarmService = {
  ensureAlarmChannel,
  scheduleAlarm,
  cancelAlarm,
  scheduleNag,
  cancelAll,
}
