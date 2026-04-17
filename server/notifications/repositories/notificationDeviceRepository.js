// Gerencia tokens de push notification e dispositivos do usuário
// Suporta múltiplos dispositivos por usuário (ex: celular + tablet)
// Rastreia Expo tokens, info do dispositivo e status de ativação

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const notificationDeviceRepository = {
  // Lista dispositivos ativos de um usuário para um provedor específico
  // Retorna: array de objetos { id, push_token, device_name, app_version, ... }
  async listActiveByUser(userId, provider = 'expo') {
    const { data, error } = await supabase
      .from('notification_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('is_active', true)

    if (error) {
      console.error('[notificationDeviceRepository.listActiveByUser]', {
        userId,
        provider,
        error: error.message,
      })
      return []
    }

    return data || []
  },

  // Insere ou atualiza dispositivo (upsert por provider+push_token)
  // Atualiza last_seen_at sempre que é chamado
  async upsert({
    userId,
    appKind,
    platform,
    provider,
    pushToken,
    deviceName,
    deviceFingerprint,
    appVersion,
  }) {
    const { error } = await supabase.from('notification_devices').upsert(
      {
        user_id: userId,
        app_kind: appKind,
        platform,
        provider,
        push_token: pushToken,
        device_name: deviceName,
        device_fingerprint: deviceFingerprint,
        app_version: appVersion,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'provider,push_token',
      }
    )

    if (error) {
      console.error('[notificationDeviceRepository.upsert]', {
        userId,
        provider,
        pushToken,
        error: error.message,
      })
      throw error
    }
  },

  // Desativa um dispositivo pelo token (marca como is_active=false)
  // Usado quando Expo retorna erro permanente (DeviceNotRegistered, etc)
  async deactivateByToken(pushToken) {
    const { error } = await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('push_token', pushToken)

    if (error) {
      console.error('[notificationDeviceRepository.deactivateByToken]', {
        pushToken,
        error: error.message,
      })
      throw error
    }
  },

  // Desativa todos os dispositivos de um usuário para um provedor
  // Usado em logout ou quando usuário remove preferência de push
  async deactivateAllForUser(userId, provider = 'expo') {
    const { error } = await supabase
      .from('notification_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', provider)

    if (error) {
      console.error('[notificationDeviceRepository.deactivateAllForUser]', {
        userId,
        provider,
        error: error.message,
      })
      throw error
    }
  },
}
