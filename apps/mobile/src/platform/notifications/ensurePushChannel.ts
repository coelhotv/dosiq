// ensurePushChannel.ts — canais Android do push remoto (expo-notifications).
//
// No Android 8+, o SOM de uma notificação é por-CANAL, não por-mensagem — o campo
// `sound` do payload de push é ignorado. Para o push remoto tocar o som do app,
// o device precisa de um canal configurado com esse som E o push precisa
// referenciar o canal (`channelId`). O id é VERSIONADO porque canal é imutável
// pós-criação (trocar o som exige bumpar o id — ver R-261). No-op no iOS (lá o
// som vem do campo `sound` da mensagem, com o .wav no bundle).
//
// Dois canais (062 F3-B, D-10):
// - DEFAULT: push comum (`push_chime`).
// - CRITICAL: push de dose essencial — espelha o canal do alarme local (`alarm_dose`, HIGH,
//   USAGE_ALARM; decisão 1 do PO). Id PRÓPRIO, nunca o `dose-alarm-critical-v3`: o
//   `isAlarmNotification` trataria o push como alarme local (FR-018, AP-327).
// O servidor só manda CRITICAL para `app_version` ≥ a versão que embarca este código
// (`resolveAndroidPushChannel`) — e esta função roda antes do `registerPushToken`.

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Sentry from '@sentry/react-native'
import { ANDROID_PUSH_CHANNEL } from '@dosiq/core'

// Id vindo da constante única do core — o servidor envia o mesmo (062 F3, FR-014).
export const PUSH_CHANNEL_ID = ANDROID_PUSH_CHANNEL.DEFAULT

// Flag por canal: só vira true no sucesso, então a próxima montagem re-tenta o que falhou.
let defaultEnsured = false
let criticalEnsured = false

async function ensureDefaultChannel() {
  if (defaultEnsured) return
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Lembretes e avisos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'push_chime.wav', // res/raw/push_chime.wav (bundlado via plugin sounds)
      vibrationPattern: [0, 250, 250, 250],
    })
    defaultEnsured = true
  } catch {
    // best-effort — sem o canal, cai no som padrão; não quebra o push
  }
}

async function ensureCriticalChannel() {
  if (criticalEnsured) return
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_PUSH_CHANNEL.CRITICAL, {
      name: 'Avisos de dose essencial',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'alarm_dose.wav', // mesmo som do alarme local (alarmService, canal -v3)
      enableVibrate: true,
      bypassDnd: true, // só vale se o acesso ao DND existir NA CRIAÇÃO (F0/Q3)
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    })
    criticalEnsured = true
  } catch (err) {
    // Decisão 2 = (a): o registro segue; o servidor ainda manda CRITICAL por versão e o push cai
    // no fallback do FCM neste aparelho. Sem silêncio — o sinal fica no Sentry.
    if (__DEV__) console.warn('[ensurePushChannel] push_critical_channel_failed', err?.message)
    Sentry.captureMessage('push_critical_channel_failed', 'warning')
  }
}

export async function ensurePushChannel() {
  if (Platform.OS !== 'android') return
  // Cada canal com try/catch próprio: falha de um não impede o outro nem o registro.
  await ensureDefaultChannel()
  await ensureCriticalChannel()
}
