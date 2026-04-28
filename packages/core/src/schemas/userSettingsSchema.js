// Schema Zod para user_settings — campos de notificação (Wave N2)
import { z } from 'zod'

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

export const NOTIFICATION_MODES = ['realtime', 'digest_morning', 'silent']

const timeSchema = z.string()
  .regex(HH_MM_REGEX, 'Formato HH:MM inválido')
  .transform(v => v?.slice(0, 5))

export const userSettingsNotificationSchema = z.object({
  notification_preference: z
    .enum(['telegram', 'mobile_push', 'both', 'none'])
    .optional(),

  notification_mode: z
    .enum(['realtime', 'digest_morning', 'silent'])
    .default('realtime'),

  quiet_hours_start: timeSchema
    .nullable()
    .optional(),

  quiet_hours_end: timeSchema
    .nullable()
    .optional(),

  digest_time: timeSchema
    .default('07:00'),

  quiet_hours_enabled: z.boolean().default(false),
  complexity_override: z.enum(['simple', 'complex']).nullable().optional(),

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
