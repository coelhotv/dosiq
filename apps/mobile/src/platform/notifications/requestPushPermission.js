// Solicita permissão para notificações push do sistema operacional
// Suporta iOS e Android via Expo Notifications

import * as Notifications from 'expo-notifications'

export async function requestPushPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') {
    return { granted: true, existing: true }
  }

  const { status } = await Notifications.requestPermissionsAsync()
  return { granted: status === 'granted', existing: false }
}
