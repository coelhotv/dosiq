// packages/core/src/schemas/nudgeSchema.js
// Schema de validação para nudges (in-app banners)

import { z } from 'zod'
import { resolveNudgeDestination } from '../utils/nudgeDestinations'

// Enums (Portuguese labels)
export const TARGET_VIEW_OPTIONS = ['dashboard', 'profile', 'any'] as const
export const TARGET_VIEW_LABELS = {
  dashboard: 'Dashboard',
  profile: 'Perfil',
  any: 'Todas',
}

export const ACTION_TYPE_OPTIONS = ['navigate', 'open_url', 'dismiss_only'] as const
export const ACTION_TYPE_LABELS = {
  navigate: 'Navegar',
  open_url: 'Abrir URL',
  dismiss_only: 'Somente info',
}

/**
 * Formato de versão do app (MAJOR.MINOR.PATCH), usado onde uma versão é DIGITADA por um humano.
 * Exportado porque o `versionGateSchema` (051 / ADR-091) valida o mesmo formato: duas regexes
 * independentes divergiriam em silêncio, e a do gate governa bloqueio de boot da base instalada.
 * Não confundir com `parseSemver` (utils/semver.ts), que é tolerante de propósito na LEITURA.
 */
export const APP_VERSION_REGEX = /^\d+\.\d+\.\d+$/

export const PLATFORM_OPTIONS = ['ios', 'android', 'all'] as const
export const PLATFORM_LABELS = {
  ios: 'iOS',
  android: 'Android',
  all: 'Todos',
}

// Zod schema — base sem refinements p/ permitir .partial() no update
const nudgeBaseSchema = z.object({
  title: z
    .string({ error: 'Título é obrigatório' })
    .min(2, 'Título deve ter ao menos 2 caracteres')
    .max(100, 'Título não pode ter mais de 100 caracteres')
    .trim(),

  body: z
    .string({ error: 'Descrição é obrigatório' })
    .min(5, 'Descrição deve ter ao menos 5 caracteres')
    .max(200, 'Descrição não pode ter mais de 200 caracteres')
    .trim(),

  target_view: z
    .enum(TARGET_VIEW_OPTIONS, { error: 'Superfície inválida' }),

  action_type: z
    .enum(ACTION_TYPE_OPTIONS, { error: 'Tipo de ação inválida' }),

  platform: z
    .enum(PLATFORM_OPTIONS, { error: 'Plataforma inválida' }),

  priority: z
    .number()
    .int('Prioridade deve ser número inteiro')
    .min(0, 'Prioridade mínima é 0')
    .max(100, 'Prioridade máxima é 100')
    .default(0)
    .nullable()
    .optional(),

  start_at: z
    .string()
    .datetime({ message: 'Data/hora inicial deve ser ISO 8601 com timezone' })
    .nullable()
    .optional(),

  end_at: z
    .string()
    .datetime({ message: 'Data/hora final deve ser ISO 8601 com timezone' })
    .nullable()
    .optional(),

  min_app_version: z
    .string()
    .regex(APP_VERSION_REGEX, 'Versão mínima do app deve ser X.Y.Z')
    .nullable()
    .optional(),

  max_app_version: z
    .string()
    .regex(APP_VERSION_REGEX, 'Versão máxima do app deve ser X.Y.Z')
    .nullable()
    .optional(),

  action_payload: z
    .record(z.string(), z.any())
    .nullable()
    .optional(),

  // `in_app_nudges.version` (integer NOT NULL DEFAULT 1). O app grava o dispensado como `id:version`:
  // subir a versão reexibe o nudge para quem já dispensou. Omitido no insert ⇒ DEFAULT 1 do banco.
  version: z
    .number()
    .int('Versão deve ser número inteiro')
    .min(1, 'Versão mínima é 1')
    .optional(),
})

const nudgeSchema = nudgeBaseSchema.superRefine((data, ctx) => {
  if (data.action_type === 'navigate') {
    const payload = data.action_payload
    if (!payload || (!payload.screen && !payload.route)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tela ou rota obrigatória para navegação',
        path: ['action_payload'],
      })
    } else if (!resolveNudgeDestination(payload)) {
      // O app só segue destinos canônicos (`NUDGE_DESTINATIONS`) — gravar outro = botão morto.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Destino de navegação fora da lista suportada pelo app',
        path: ['action_payload'],
      })
    }
  } else if (data.action_type === 'open_url') {
    const payload = data.action_payload
    if (!payload || !payload.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL obrigatória para ação de abrir URL',
        path: ['action_payload'],
      })
    } else {
      try {
        new URL(payload.url)
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'URL inválida',
          path: ['action_payload'],
        })
      }
    }
  }
})

export function validateNudgeCreate(data: unknown) {
  const result = nudgeSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}

// Payload com cara de navegação é validado mesmo sem `action_type` no corpo: um PATCH parcial só
// com `action_payload` sobre uma linha `navigate` não pode furar a lista canônica (RC6 #914).
const looksLikeNavigate = (payload: Record<string, unknown>) =>
  'route' in payload || 'screen' in payload || 'tab' in payload

const nudgeUpdateSchema = nudgeBaseSchema.partial().superRefine((data, ctx) => {
  const payload = data.action_payload
  const isNavigate = data.action_type === 'navigate' || (payload && looksLikeNavigate(payload))
  if (isNavigate && payload && !resolveNudgeDestination(payload)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Destino de navegação fora da lista suportada pelo app',
      path: ['action_payload'],
    })
  }
})

export function validateNudgeUpdate(data: unknown) {
  const result = nudgeUpdateSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    }
  }

  // AP-304: `.partial()` não desliga o `.default(0)` de `priority` — sem este recorte, um update
  // parcial (ex.: só `title`) devolveria `priority: 0` e o handler zeraria a prioridade gravada.
  const sent = data && typeof data === 'object' ? Object.keys(data) : []
  const picked = Object.fromEntries(
    Object.entries(result.data).filter(([key]) => sent.includes(key)),
  ) as typeof result.data

  return {
    success: true,
    data: picked,
  }
}

export default nudgeSchema
