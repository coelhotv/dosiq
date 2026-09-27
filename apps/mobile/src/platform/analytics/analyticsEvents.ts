// Catálogo centralizado de eventos — nunca usar strings literais fora deste arquivo
// Fonte: EXEC_SPEC_HIBRIDO_H6_SPRINT_PLAN.md § Sprint 6.3.5

export const EVENTS = {
  // Autenticação
  LOGIN: 'login',                              // method: 'email' | 'google'
  LOGOUT: 'logout',
  SIGNUP: 'sign_up',                           // method: 'email' — emitido na verificação do OTP (conta real), nunca no signUp

  // Onboarding
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  ONBOARDING_SKIP: 'onboarding_skip',

  // Ciclo de vida do tratamento (spec 065 US3 / CON-034). Pausa ≠ encerramento: `active` true→false
  // é `treatment_paused` (reversível), nunca `treatment_ended`. Emitidos SÓ pela casca do
  // protocolService (+ `emitTitrationEdited`, chamado pelo titrationService) — tela nenhuma emite.
  TREATMENT_CREATED: 'treatment_created',   // entry_point, frequency, interval_days, treatment_plan_id?, is_titration, treatment_planned_end?
  TREATMENT_EDITED: 'treatment_edited',     // change_kind: string[] (dose|schedule|frequency|dates|alarm|plan|details|titration) — nunca o valor
  TREATMENT_PAUSED: 'treatment_paused',
  TREATMENT_RESUMED: 'treatment_resumed',
  TREATMENT_ENDED: 'treatment_ended',       // reason: 'deleted' (único ativo; prescription_end é derivado)

  // Evolução do tratamento (titulação) — 065 T046a. `surface` é CANAL (SURFACES); o ponto de toque
  // vai em `placement` (PLACEMENTS). `treatment_id` só quando a RPC devolve o protocolo (R-299 §4).
  TITRATION_TRANSITION_CONFIRMED: 'titration_transition_confirmed', // step_id, outcome, surface, placement?, treatment_id?
  TITRATION_TRANSITION_POSTPONED: 'titration_transition_postponed', // step_id, surface, placement?

  // Medicamentos
  MEDICINE_ADDED: 'medicine_added',
  MEDICINE_EDITED: 'medicine_edited',
  MEDICINE_DELETED: 'medicine_deleted',

  // Doses
  DOSE_LOGGED: 'dose_logged',                  // medicine_id (UUID opaco) + action opcional — nunca nome/PII clínico
  DOSE_LOGGED_BULK: 'dose_logged_bulk',         // count: número de doses registradas em batch
  DOSE_SKIPPED: 'dose_skipped',

  // Notificações
  NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
  NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
  NOTIFICATION_PREFERENCE_CHANGED: 'notification_preference_changed', // new_preference
  PUSH_NOTIFICATION_TAPPED: 'push_notification_tapped',               // kind: kind do servidor, verbatim (enum fechado)
  // 065 AD-8: o lembrete é UM só para a pessoa, qualquer que seja o canal. `source` é a origem do
  // aviso (REMINDER_SOURCES); `surface` segue sendo o canal do toque.
  REMINDER_OPENED: 'reminder_opened',   // source, surface — lembrete de dose abriu o app
  DOSE_SNOOZED: 'dose_snoozed',         // source, surface — Adiar/Soneca num lembrete

  // App / consentimento (065 PR D / US9 — consent_health_declined APOSENTADO, ver CON-034 §5)
  COLD_START: 'cold_start',                        // duration_ms + bundle tags + env tags
  CONSENT_PROMPT_SHOWN: 'consent_prompt_shown',       // blocking: boolean, source (ver CONSENT_GRANTED)
  CONSENT_PROMPT_DISMISSED: 'consent_prompt_dismissed', // source — só existe quando !blocking
  CONSENT_GRANTED: 'consent_granted',                 // source: prompt_blocking|prompt_dismissible|prompt_navigated|resolution_revoked
  CONSENT_REVOKED: 'consent_revoked',                 // {}
  CONSENT_BLOCKED_ATTEMPT: 'consent_blocked_attempt', // gate_mode: blocked_revoked|prompt_blocking — NÃO `mode` (super property)

  // Conta (065 PR D / US9)
  ACCOUNT_DELETED: 'account_deleted',                 // result: 'success'|'error'

  // Estoque
  STOCK_ADDED: 'stock_added',
  STOCK_LOW_VIEWED: 'stock_low_viewed',

  // Famílias novas (065 US6) — só meta/tipo, NUNCA valor/texto/PII (FR-8, R-042).
  BIOMARKER_LOGGED: 'biomarker_logged',               // biomarker_type: BIOMARKER_TYPES do core (glicemia|peso|pressao_arterial|batimentos) — NUNCA value/value_secondary
  AI_ASSISTANT_MESSAGE_SENT: 'ai_assistant_message_sent', // has_error: boolean — NUNCA a mensagem nem a resposta
  PROFILE_UPDATED: 'profile_updated',                 // {} — NUNCA display_name/birth_date/city/phone
  MODE_CHANGED: 'mode_changed',                       // mode: 'simple'|'complex'|'auto'

  // Modo dose-only (spec 044, FR-010) — insumo da métrica dos 90 dias (SC-004).
  // Emitidos SÓ pelo stockPreferenceService (origem comum): tela nenhuma loga preferência.
  STOCK_ONBOARDING_CHOICE: 'stock_onboarding_choice',   // mode: 'dose_only' | 'stock'
  STOCK_OPT_IN: 'stock_opt_in',                          // source: onboarding | settings | upsell
  STOCK_OPT_OUT: 'stock_opt_out',                        // source
  STOCK_UPSELL_SHOWN: 'stock_upsell_shown',
  STOCK_UPSELL_CONVERSION: 'stock_upsell_conversion',
  STOCK_UPSELL_DISMISSED: 'stock_upsell_dismissed',
}

// Superfície de ORIGEM da ação (spec 065 / US1). Responde a pergunta da tese: o usuário que
// registra a dose pela notificação e nunca abre o app está no estado IDEAL, não em churn — sem
// esta propriedade os dois casos são indistinguíveis no PostHog.
//
// 🔴 NÃO existe default: emissor que não informa a origem manda o evento SEM a chave. Um
// `surface = 'mobile'` implícito faria todo registro por push parecer app-aberto — a US1 morta em
// silêncio, com aparência de medida (plan.md A-1).
export const SURFACES = {
  MOBILE: 'mobile',   // app em primeiro plano
  PUSH: 'push',       // botão da notificação (sem abrir o app)
  ALARM: 'alarm',     // tela cheia do alarme de dose crítica
}

// Fluxo de ORIGEM da criação de tratamento (065 AD-1). Eixo diferente de `surface`: onboarding é
// fluxo dentro do app (surface continua 'mobile'), não canal.
export const ENTRY_POINTS = {
  ONBOARDING: 'onboarding',
  TREATMENT_FORM: 'treatment_form',
  // 065 AD-8: dose registrada na modal que um lembrete abriu (deeplink). Separa "abriu pelo aviso
  // e tomou" de "abriu o app e tomou" — os dois saem `surface:'mobile'`.
  REMINDER: 'reminder',
}

// Origem do LEMBRETE (065 AD-8). Eixo diferente de `surface`: o mesmo aviso chega por canais
// distintos; a leitura principal ignora `source`.
export const REMINDER_SOURCES = {
  SERVER_PUSH: 'server_push',     // push remoto do servidor (expo)
  ALARM: 'alarm',                 // alarme local do Notifee (dose crítica)
  DOSE_ACTIVITY: 'dose_activity', // superfície de dose ativa (Notifee Android / Live Activity iOS)
}

// Ponto de TOQUE dentro do app (065 T046a). Eixo diferente de `surface` (canal): mesmo raciocínio do
// `entry_point` (AD-1). Só existe para emissões com surface 'mobile'.
export const PLACEMENTS = {
  TIMELINE_BANNER: 'timeline_banner',
  TODAY_CARD: 'today_card',
}
