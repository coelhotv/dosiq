// Gerencia tokens de push notification e dispositivos do usuário
// Suporta múltiplos dispositivos por usuário (ex: celular + tablet)
// Rastreia Expo tokens, info do dispositivo e status de ativação

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getNow, getServerTimestamp } from '../../utils/dateUtils.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const upsertSchema = z.object({
  userId: z.string().uuid(),
  appKind: z.enum(['native', 'pwa']),
  platform: z.enum(['ios', 'android', 'web']),
  provider: z.enum(['expo', 'webpush']),
  pushToken: z.string().min(1),
  deviceName: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  appVersion: z.string().optional(),
})

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
  // Atualiza last_seen_at e updated_at sempre que é chamado
  // Aceita parâmetro `now` opcional para facilitar testes determinísticos
  async upsert({
    userId,
    appKind,
    platform,
    provider,
    pushToken,
    deviceName,
    deviceFingerprint,
    appVersion,
    now = getNow(),
  }) {
    const parsed = upsertSchema.safeParse({ userId, appKind, platform, provider, pushToken, deviceName, deviceFingerprint, appVersion })
    if (!parsed.success) {
      throw new Error(`[notificationDeviceRepository.upsert] Invalid input: ${parsed.error.message}`)
    }

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
        last_seen_at: now.toISOString(),
        updated_at: now.toISOString(),
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
      .update({ is_active: false, updated_at: getServerTimestamp() })
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
      .update({ is_active: false, updated_at: getServerTimestamp() })
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
