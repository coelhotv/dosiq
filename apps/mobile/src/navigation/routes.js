// routes.js — registro canônico de nomes de rota do app mobile
// R5-009: rotas NÃO devem ser strings espalhadas pelo app
// Importar sempre deste módulo para evitar inconsistências

export const ROUTES = {
  // Raiz auth-aware
  SMOKE: 'Smoke',
  LOGIN: 'Login',
  LANDING: 'Landing',
  SIGNUP: 'Signup',
  FORGOT_PASSWORD: 'ForgotPassword',
  RESET_PASSWORD: 'ResetPassword',

  // Shell do produto (tab navigator)
  TABS: 'Tabs',

  // Tabs principais
  TODAY: 'Hoje',
  TREATMENTS: 'Tratamentos',
  STOCK: 'Estoque',
  PROFILE: 'Perfil',

  // Sub-rotas de Tratamentos
  TREATMENTS_LIST: 'TreatmentsList',
  TREATMENT_DETAIL: 'TreatmentDetail',

  // Sub-rotas de Perfil
  PROFILE_MAIN: 'ProfileMain',
  TELEGRAM_LINK: 'TelegramLink',
  NOTIFICATION_PREFERENCES: 'NotificationPreferences',
  NOTIFICATION_INBOX: 'NotificationInbox',

  // ANVISA search (Sprint P.2)
  ANVISA_SEARCH: 'AnvisaSearch',

  // Sub-rotas de Medicamentos (Fase 1 — placeholders registrados na P.3)
  MEDICINE_CREATE: 'MedicineCreate',
  MEDICINE_EDIT: 'MedicineEdit',
  MEDICINE_DETAIL: 'MedicineDetail',

  // Dev-only (apenas __DEV__)
  FORM_KIT_DEMO: 'FormKitDemo',
}
