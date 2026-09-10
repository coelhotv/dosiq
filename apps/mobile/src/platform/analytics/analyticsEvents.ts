// Catálogo centralizado de eventos — nunca usar strings literais fora deste arquivo
// Fonte: EXEC_SPEC_HIBRIDO_H6_SPRINT_PLAN.md § Sprint 6.3.5

export const EVENTS = {
  // Autenticação
  LOGIN: 'login',                              // method: 'email' | 'google'
  LOGOUT: 'logout',
  SIGNUP: 'sign_up',                           // Firebase reserved — mapeia para funil de conversão

  // Onboarding
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  ONBOARDING_SKIP: 'onboarding_skip',

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
  PUSH_NOTIFICATION_TAPPED: 'push_notification_tapped',               // kind: dose_reminder | stock_alert

  // Estoque
  STOCK_ADDED: 'stock_added',
  STOCK_LOW_VIEWED: 'stock_low_viewed',

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
