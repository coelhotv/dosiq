// packages/core/src/schemas/criticalAuditEventSchema.js
// Schema de validação para public.dose_critical_events (042 Slice A — audit trail)
//
// Espelha exatamente os CHECKs SQL da tabela (event/platform/actor). `detail` é jsonb
// livre — não há CHECK no banco pra ele, então aceitamos qualquer objeto serializável.
// Sem `createdAt`: created_at é default now() no DB, não faz parte do payload de escrita.

import { z } from 'zod'

// Eventos do ciclo de vida de dose crítica (alarme → nag → snooze → resolved) + push
// (envio/falha/skip) + observabilidade (surface_transitioned, token_captured).
export const CRITICAL_AUDIT_EVENTS = [
  'alarm_scheduled',
  'alarm_fired',
  'alarm_suppressed',
  'nag_fired',
  'snoozed',
  'resolved',
  'push_sent',
  'push_failed',
  'surface_transitioned',
  'push_skipped_no_token',
  'token_captured',
]

export const CRITICAL_AUDIT_PLATFORMS = ['ios', 'android', 'server']

export const CRITICAL_AUDIT_ACTORS = ['user', 'system', 'server']

export const criticalAuditEventSchema = z.object({
  userId: z.string().uuid('ID do usuário deve ser um UUID válido'),

  doseInstanceId: z.string().uuid('ID da ocorrência deve ser um UUID válido').nullable().optional(),

  event: z.enum(CRITICAL_AUDIT_EVENTS),

  platform: z.enum(CRITICAL_AUDIT_PLATFORMS),

  actor: z.enum(CRITICAL_AUDIT_ACTORS),

  // jsonb livre — payload de contexto (ex.: motivo da supressão, delta de snooze).
  detail: z.record(z.string(), z.unknown()).nullable().optional(),
})

export default criticalAuditEventSchema
