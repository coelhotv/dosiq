// Registra ou atualiza device no banco de dados
// Usa onConflict: 'provider,push_token' para upsert idempotente

import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Application from 'expo-application'

export async function syncNotificationDevice({ supabase, userId, token }) {
  if (!supabase) {
    throw new Error('[syncNotificationDevice] supabase client required')
  }
  if (!userId) {
    throw new Error('[syncNotificationDevice] userId required')
  }
  if (!token) {
    throw new Error('[syncNotificationDevice] token required')
  }

  const deviceFingerprint = JSON.stringify({
    os: Platform.OS,
    osVersion: Platform.Version,
    deviceModel: Device.modelName,
    appVersion: Application.nativeApplicationVersion,
  })

  const { data, error } = await supabase
    .from('notification_devices')
    .upsert(
      {
        user_id: userId,
        app_kind: 'native',
        platform: Platform.OS,
        provider: 'expo',
        push_token: token,
        device_name: Device.modelName,
        device_fingerprint: deviceFingerprint,
        app_version: Application.nativeApplicationVersion,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'provider,push_token' }
    )

  if (error) {
    throw new Error(`[syncNotificationDevice] Upsert failed: ${error.message}`)
  }

  return data
}
