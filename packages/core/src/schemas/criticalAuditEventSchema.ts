// packages/core/src/schemas/criticalAuditEventSchema.js
// Schema de validação para public.dose_critical_events (042 Slice A — audit trail)
//
// Espelha exatamente os CHECKs SQL da tabela (event/platform/actor). `detail` é jsonb
// livre — não há CHECK no banco pra ele, então aceitamos qualquer objeto serializável.
// Sem `createdAt`: created_at é default now() no DB, não faz parte do payload de escrita.

import { z } from 'zod'

// Eventos do ciclo de vida de dose crítica (alarme → nag → snooze → resolved) + push
// (envio/falha/skip) + observabilidade (surface_transitioned, token_captured) + evolução do
// tratamento (titration_transitioned).
//
// ⚠️ R-271: este array espelha o CHECK `dose_critical_events_event_check`. Valor novo aqui
// SEM migração do CHECK = insert que falha só em runtime (23514). Andam sempre juntos.
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
  // 029 F3 (ADR-080): transição de etapa da Evolução do tratamento. `doseInstanceId` fica NULL —
  // a transição é do TRATAMENTO, não de uma ocorrência de dose. Emitido pela RPC
  // `confirm_titration_switch` (actor 'user') e pelo motor do cron (actor 'system').
  'titration_transitioned',
  // 067 A2 (FR-007): a guarda bilateral de janela barrou um disparo — `detail` é ALLOWLIST FECHADA
  // (`delta_seconds`, `direction`, `manufacturer`, `model`, `os_version` — FR-036), nunca o payload
  // da notificação, que carrega nome e dosagem do medicamento. Emitido pelo device
  // (`outOfWindowNotice.reportOutOfWindowAlarm`) e DESCARTADO no flush quando o consentimento está
  // revogado (FR-035): trilha de saúde não se coleta sem base legal, e o fail-open da FR-008 vale
  // só p/ falha de rede. Enquanto o Slice C não fecha, a métrica é confiável só em Android (FR-009 —
  // iOS deriva o instante no foreground, AP-257).
  'alarm_out_of_window',
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

  // 067 C.2 (FR-042) — instante em que o FATO ocorreu, carimbado na ORIGEM. Distinto de
  // `created_at` (default now() no DB), que é quando a LINHA entrou: com a fila offline drenando
  // só no foreground, os dois podem estar a dezenas de minutos de distância (medido: 20 min).
  // NULLABLE de propósito — NULL significa "hora do fato desconhecida", que é o estado honesto do
  // evento iOS derivado no foreground (AP-257) e de toda linha legada. NUNCA default now() aqui:
  // carimbar a hora do insert reintroduziria o erro com aparência de dado bom.
  occurredAt: z.string().datetime({ offset: true }).nullable().optional(),
})

export default criticalAuditEventSchema
