// Schema Zod para user_settings — campos de notificação (Wave N2)
import { z } from 'zod'

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

export const NOTIFICATION_MODES = ['realtime', 'digest_morning', 'silent']

// Fusos horários do Brasil (IANA) — ADR-049. Enum BR-only é mais seguro que regex livre.
export const TIMEZONES_BR = [
  'America/Sao_Paulo',   // Brasília (GMT-3) — Sul/Sudeste/Nordeste/DF
  'America/Manaus',      // Amazonas (GMT-4)
  'America/Cuiaba',      // Mato Grosso (GMT-4)
  'America/Campo_Grande',// Mato Grosso do Sul (GMT-4)
  'America/Porto_Velho', // Rondônia (GMT-4)
  'America/Boa_Vista',   // Roraima (GMT-4)
  'America/Rio_Branco',  // Acre (GMT-5)
  'America/Eirunepe',    // Amazonas oeste (GMT-5)
  'America/Belem',       // Pará leste (GMT-3)
  'America/Santarem',    // Pará oeste (GMT-3)
  'America/Fortaleza',   // Ceará/PI/RN/PB/AL/SE (GMT-3)
  'America/Recife',      // Pernambuco (GMT-3)
  'America/Bahia',       // Bahia (GMT-3)
  'America/Maceio',      // Alagoas (GMT-3)
  'America/Araguaina',   // Tocantins (GMT-3)
  'America/Noronha',     // Fernando de Noronha (GMT-2)
]

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

  // ADR-049 — fonte de verdade do fuso para cálculo temporal tz-aware.
  // DB: NOT NULL DEFAULT 'America/Sao_Paulo' → Zod usa .default() sem nullable (R-082).
  timezone: z.enum(TIMEZONES_BR).default('America/Sao_Paulo'),
})

// Derivar notification_preference legado a partir dos booleans de canal
export function deriveLegacyPreference({ channel_mobile_push_enabled, channel_telegram_enabled }) {
  if (channel_mobile_push_enabled && channel_telegram_enabled) return 'both'
  if (channel_mobile_push_enabled) return 'mobile_push'
  if (channel_telegram_enabled) return 'telegram'
  return 'none'
}
