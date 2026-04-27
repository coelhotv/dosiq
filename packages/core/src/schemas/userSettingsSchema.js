// Schema Zod para user_settings — campos de notificação (Wave N2)
import { z } from 'zod'

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

export const NOTIFICATION_MODES = ['realtime', 'digest_morning', 'silent']

export const userSettingsNotificationSchema = z.object({
  notification_preference: z
    .enum(['telegram', 'mobile_push', 'both', 'none'])
    .optional(),

  notification_mode: z
    .enum(['realtime', 'digest_morning', 'silent'])
    .default('realtime'),

  quiet_hours_start: z
    .string()
    .regex(HH_MM, 'Formato HH:MM inválido')
    .nullable()
    .optional(),

  quiet_hours_end: z
    .string()
    .regex(HH_MM, 'Formato HH:MM inválido')
    .nullable()
    .optional(),

  digest_time: z
    .string()
    .regex(HH_MM, 'Formato HH:MM inválido')
    .default('07:00'),

  channel_mobile_push_enabled: z.boolean().default(true),
  channel_web_push_enabled:    z.boolean().default(false),
  channel_telegram_enabled:    z.boolean().default(false),
})

// Derivar notification_preference legado a partir dos booleans de canal
export function deriveLegacyPreference({ channel_mobile_push_enabled, channel_telegram_enabled }) {
  if (channel_mobile_push_enabled && channel_telegram_enabled) return 'both'
  if (channel_mobile_push_enabled) return 'mobile_push'
  if (channel_telegram_enabled) return 'telegram'
  return 'none'
}
