// Schema Zod para user_settings — campos de notificação (Wave N2)
import { z } from 'zod'

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

export const NOTIFICATION_MODES = ['realtime', 'digest_morning', 'silent']

// Fusos aceitos (IANA) — ADR-049/ADR-053. Enum curado é mais seguro que regex livre.
// Ordenados pelo horário do relógio crescente = GMT decrescente (GMT+0 → GMT-8): fusos mais
// adiantados primeiro. Dentro do mesmo offset, fusos BR vêm antes dos expat e São Paulo
// (default + mais populoso) encabeça o GMT-3.
// O `offset` é só dica de label/ordenação — o DST é resolvido pelo NOME IANA via Intl,
// NUNCA pelo offset (offset≠identidade: mesmos offsets divergem em datas de DST). Armazenar
// SEMPRE o IANA. Expat = Caminho B curado (ADR-053); Caminho C (IANA completo) gated (YAGNI).
export const TIMEZONE_OPTIONS = [
  { value: 'Europe/Lisbon',        label: 'Lisboa, Portugal (GMT+0/+1)',           offset: 0 },
  { value: 'Europe/London',        label: 'Londres, Reino Unido (GMT+0/+1)',       offset: 0 },
  { value: 'America/Noronha',      label: 'Fernando de Noronha (GMT-2)',           offset: -2 },
  { value: 'America/Sao_Paulo',    label: 'Brasília, São Paulo, Rio (GMT-3)',      offset: -3 },
  { value: 'America/Belem',        label: 'Belém, Pará (leste), Amapá (GMT-3)',    offset: -3 },
  { value: 'America/Fortaleza',    label: 'Fortaleza, Ceará e Nordeste (GMT-3)',   offset: -3 },
  { value: 'America/Recife',       label: 'Recife, Pernambuco (GMT-3)',            offset: -3 },
  { value: 'America/Maceio',       label: 'Maceió, Alagoas (GMT-3)',               offset: -3 },
  { value: 'America/Bahia',        label: 'Salvador, Bahia (GMT-3)',               offset: -3 },
  { value: 'America/Araguaina',    label: 'Araguaína, Tocantins (GMT-3)',          offset: -3 },
  { value: 'America/Santarem',     label: 'Santarém, Pará (oeste) (GMT-3)',        offset: -3 },
  { value: 'America/Campo_Grande', label: 'Campo Grande, Mato Grosso do Sul (GMT-4)', offset: -4 },
  { value: 'America/Cuiaba',       label: 'Cuiabá, Mato Grosso (GMT-4)',           offset: -4 },
  { value: 'America/Manaus',       label: 'Manaus, Amazonas (GMT-4)',              offset: -4 },
  { value: 'America/Boa_Vista',    label: 'Boa Vista, Roraima (GMT-4)',            offset: -4 },
  { value: 'America/Porto_Velho',  label: 'Porto Velho, Rondônia (GMT-4)',         offset: -4 },
  { value: 'America/Rio_Branco',   label: 'Rio Branco, Acre (GMT-5)',              offset: -5 },
  { value: 'America/Eirunepe',     label: 'Eirunepé, Amazonas (oeste) (GMT-5)',    offset: -5 },
  { value: 'America/New_York',     label: 'Nova York, EUA (leste) (GMT-5/-4)',     offset: -5 },
  { value: 'America/Los_Angeles',  label: 'Los Angeles, EUA (oeste) (GMT-8/-7)',   offset: -8 },
]

// Lista de fusos aceitos (BR-first + expat curados, ADR-053). Nome mantido por
// retrocompat (importado por mobile/profileService + barrel) — hoje inclui não-BR.
export const TIMEZONES_BR = TIMEZONE_OPTIONS.map((o) => o.value)

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
