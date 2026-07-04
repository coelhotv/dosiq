// Gerencia preferências de notificação do usuário (Telegram, Push, ambas ou nenhuma)
// Lê de user_settings.notification_preference e verifica telegram_chat_id

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { z } from 'zod'

const notificationPreferenceSchema = z.enum(['telegram', 'mobile_push', 'both', 'none'])

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
)

export type NotificationPreference = 'telegram' | 'mobile_push' | 'both' | 'none'

export interface NotificationSettings {
  notification_mode: string
  quiet_hours_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  digest_time: string
  timezone: string
  channel_mobile_push_enabled?: boolean
  channel_web_push_enabled?: boolean
  channel_telegram_enabled?: boolean
}

export const notificationPreferenceRepository = {
  // Obtém preferência de notificação do usuário
  // Retorna: 'telegram', 'mobile_push', 'both', ou 'none'
  async getByUserId(userId: string): Promise<NotificationPreference> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('notification_preference')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[notificationPreferenceRepository.getByUserId]', {
        userId,
        error: error.message,
      })
      // Default fallback para compatibilidade retroativa
      return 'telegram'
    }

    return data?.notification_preference || 'telegram'
  },

  // Verifica se usuário tem chat_id do Telegram registrado
  // Retorna: true se telegram_chat_id está preenchido, false caso contrário
  async hasTelegramChat(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[notificationPreferenceRepository.hasTelegramChat]', {
        userId,
        error: error.message,
      })
      return false
    }

    return Boolean(data?.telegram_chat_id)
  },

  // Atualiza preferência de notificação do usuário
  async setPreference(userId: string, preference: NotificationPreference): Promise<void> {
    const parsed = notificationPreferenceSchema.safeParse(preference)
    if (!parsed.success) {
      throw new Error(
        `[notificationPreferenceRepository.setPreference] Invalid preference: ${preference}. Must be one of: telegram, mobile_push, both, none`
      )
    }

    const { error } = await supabase
      .from('user_settings')
      .update({ notification_preference: preference })
      .eq('user_id', userId)

    if (error) {
      console.error('[notificationPreferenceRepository.setPreference]', {
        userId,
        preference,
        error: error.message,
      })
      throw error
    }
  },

  // Obtém configurações completas de notificação para o gate/dispatcher (Wave N2)
  async getSettingsByUserId(userId: string): Promise<NotificationSettings> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('notification_mode, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, digest_time, timezone, channel_mobile_push_enabled, channel_web_push_enabled, channel_telegram_enabled')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[notificationPreferenceRepository.getSettingsByUserId]', {
        userId,
        error: error.message,
      })
      // Defaults seguros
      return {
        notification_mode: 'realtime',
        quiet_hours_enabled: false,
        quiet_hours_start: null,
        quiet_hours_end: null,
        digest_time: '08:00',
        timezone: 'America/Sao_Paulo'
      }
    }

    return data
  },
}
