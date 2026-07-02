// staleDoseNotifications.js — reconciliação de notificações de dose VELHAS (Spec 001/039 fix)
//
// O SO não remove sozinho a notificação local (alarme/nag/superfície 039) quando a dose passa da
// janela de tomada (missed): a reconciliação p/ `missed` acontece no servidor (DB), mas nada dismissa
// a notif no device se a cadeia de triggers quebrar (app morto / Doze / simulador suspenso a noite
// toda). Resultado: alarme/superfície presos horas/dias. Pior: no foreground o app REABRE o alarme
// velho como takeover → tocar "Tomei" batia em P0001 ('já registrada ou indisponível').
//
// Este módulo varre `getDisplayedNotifications` e cancela as vencidas. Cross-plataforma (iOS pela
// categoria; a superfície iOS = Live Activity é encerrada à parte pelo DoseLiveActivityBridge/041).

import notifee from '@notifee/react-native'
import { parseISO, getRawNow } from '@dosiq/core'
import { ALARM_CHANNEL_ID, ALARM_CRITICAL_CHANNEL_ID, cancelAlarm } from './alarmService'
import { endDoseActivity, DOSE_ACTIVITY_CHANNEL_ID } from '@platform/doseActivity/doseActivitySurfaceService'

// Tolerância default da tomada (CON-026 — DEFAULT_TOLERANCE_MINUTES). Local p/ não acoplar ao service
// do core; a janela real por-dose vem em data.toleranceMinutes quando presente.
const DEFAULT_TOLERANCE_MINUTES = 120

/** Notificação do canal/categoria de alarme (Android por canal; iOS por categoria). */
export function isAlarmNotification(notification) {
  if (!notification) return false
  const channelId = notification.android?.channelId
  return (
    channelId === ALARM_CHANNEL_ID ||
    channelId === ALARM_CRITICAL_CHANNEL_ID ||
    notification.ios?.categoryId === ALARM_CHANNEL_ID
  )
}

/** Notificação da superfície 039 (canal próprio / flag __surface). */
export function isSurfaceNotification(notification) {
  const data = notification?.data || {}
  return data.__surface === 'true' || notification?.android?.channelId === DOSE_ACTIVITY_CHANNEL_ID
}

/**
 * Dose VELHA = janela de tomada já passou (scheduled + tolerância) → virou missed. Deriva do próprio
 * `data` (self-contained, sem fetch). Sem scheduledFor → não afirma (não mexe).
 */
export function isDoseNotificationStale(data, now = getRawNow()) {
  if (!data?.scheduledFor) return false
  const scheduledMs = parseISO(data.scheduledFor).getTime()
  if (Number.isNaN(scheduledMs)) return false
  const raw = data.toleranceMinutes
  const tol = raw != null && raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : DEFAULT_TOLERANCE_MINUTES
  return now.getTime() > scheduledMs + tol * 60000
}

/**
 * Varre as notificações exibidas e cancela toda notif de dose (alarme/nag/superfície) já vencida.
 * Roda no foreground/launch. Best-effort — nunca lança.
 */
export async function reconcileStaleDoseNotifications(now = getRawNow()) {
  let displayed = []
  try {
    displayed = await notifee.getDisplayedNotifications()
  } catch {
    return
  }
  // Superfícies velhas são independentes → dispara em paralelo (best-effort) p/ não segurar
  // a reconciliação no foreground quando há várias notificações presas.
  const promises = []
  for (const item of displayed) {
    const notification = item?.notification || item
    const data = notification?.data || {}
    if (!data.doseInstanceId) continue
    if (!isAlarmNotification(notification) && !isSurfaceNotification(notification)) continue
    if (!isDoseNotificationStale(data, now)) continue
    promises.push(
      Promise.resolve(cancelAlarm(data.doseInstanceId)).catch(() => {}),
      Promise.resolve(endDoseActivity(data.doseInstanceId)).catch(() => {}),
    )
  }
  if (promises.length > 0) await Promise.all(promises)
}
