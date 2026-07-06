// Obtém o Expo Push Token para o device
// Requer EAS projectId configurado em app.config.js

import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

export async function getExpoPushToken() {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) {
    throw new Error('EAS projectId não configurado em app.config.js (Constants.expoConfig.extra.eas.projectId)')
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  return token
}
