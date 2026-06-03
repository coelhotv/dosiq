// ensurePushChannel.js — canal Android do push remoto (expo-notifications) com o
// som próprio do app (push_chime.wav).
//
// No Android 8+, o SOM de uma notificação é por-CANAL, não por-mensagem — o campo
// `sound` do payload de push é ignorado. Para o push remoto tocar `push_chime`,
// o device precisa de um canal configurado com esse som E o push precisa
// referenciar o canal (`channelId`). O id é VERSIONADO porque canal é imutável
// pós-criação (trocar o som exige bumpar o id — ver R-261). No-op no iOS (lá o
// som vem do campo `sound` da mensagem, com o .wav no bundle).

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

// Mantido em sync com o `channelId` enviado pelo server (expoPushChannel.js).
export const PUSH_CHANNEL_ID = 'dosiq-default-v1'

let ensured = false

export async function ensurePushChannel() {
  if (Platform.OS !== 'android' || ensured) return
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Lembretes e avisos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'push_chime.wav', // res/raw/push_chime.wav (bundlado via plugin sounds)
      vibrationPattern: [0, 250, 250, 250],
    })
    ensured = true
  } catch {
    // best-effort — sem o canal, cai no som padrão; não quebra o push
  }
}
