// ensurePushChannel.ts — canal Android do push remoto (expo-notifications) com o
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
import { ANDROID_PUSH_CHANNEL } from '@dosiq/core'

// Id vindo da constante única do core — o servidor envia o mesmo (062 F3, FR-014).
export const PUSH_CHANNEL_ID = ANDROID_PUSH_CHANNEL.DEFAULT

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
