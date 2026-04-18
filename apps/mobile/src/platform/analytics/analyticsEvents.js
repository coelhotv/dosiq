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
  DOSE_LOGGED: 'dose_logged',                  // medicine_name (sem PII clínico)
  DOSE_SKIPPED: 'dose_skipped',

  // Notificações
  NOTIFICATION_PERMISSION_GRANTED: 'notification_permission_granted',
  NOTIFICATION_PERMISSION_DENIED: 'notification_permission_denied',
  NOTIFICATION_PREFERENCE_CHANGED: 'notification_preference_changed', // new_preference
  PUSH_NOTIFICATION_TAPPED: 'push_notification_tapped',               // kind: dose_reminder | stock_alert

  // Estoque
  STOCK_ADDED: 'stock_added',
  STOCK_LOW_VIEWED: 'stock_low_viewed',

  // Navegação (automático via useScreenTracking)
  SCREEN_VIEW: 'screen_view',                  // Firebase reserved — screen_name, screen_class
}
