// Registra ou reivindica um device token via RPC upsert_notification_device.
// Modelo "último usuário sobrescreve": em dispositivos compartilhados o token
// pertence sempre ao usuário que fez login mais recentemente.
// RPC com SECURITY DEFINER é necessária porque o upsert direto falha com RLS
// quando o token já existe associado a outro user_id.

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

  const { error } = await supabase.rpc('upsert_notification_device', {
    p_provider:           'expo',
    p_push_token:         token,
    p_platform:           Platform.OS,
    p_app_kind:           'native',
    p_device_name:        Device.modelName,
    p_device_fingerprint: deviceFingerprint,
    p_app_version:        Application.nativeApplicationVersion,
  })

  if (error) {
    throw new Error(`[syncNotificationDevice] Upsert failed: ${error.message}`)
  }
}
