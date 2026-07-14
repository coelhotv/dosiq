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

  // Alarme nativo em tela cheia (Spec 001) — aberto pelo full-screen intent
  ALARM_FULLSCREEN: 'AlarmFullScreen',

  // Tabs principais
  TODAY: 'Hoje',
  TREATMENTS: 'Tratamentos',
  STOCK: 'Estoque',
  PROFILE: 'Perfil',

  // Sub-rotas de Tratamentos
  TREATMENTS_LIST: 'TreatmentsList',
  TREATMENT_DETAIL: 'TreatmentDetail',

  // Sub-rotas de Tratamentos (Fase 2)
  PROTOCOL_FORM: 'ProtocolForm',
  PROTOCOL_DETAIL: 'ProtocolDetail',

  // Sub-rotas de Perfil
  PROFILE_MAIN: 'ProfileMain',
  PROFILE_EDIT: 'ProfileEdit',           // Fase 4 — Editar Perfil V1
  SETTINGS: 'Settings',                  // Fase 4 — Configurações (densidade + segurança)
  CHANGE_PASSWORD: 'ChangePassword',     // Fase 4 — Alterar senha
  DELETE_ACCOUNT: 'DeleteAccount',       // Fase 4 — Excluir conta
  PRIVACY_DATA: 'PrivacyData',           // Spec 008 — hub Privacidade e dados (export + política + exclusão)
  TELEGRAM_LINK: 'TelegramLink',
  NOTIFICATION_PREFERENCES: 'NotificationPreferences',
  NOTIFICATION_INBOX: 'NotificationInbox',
  FEEDBACK: 'Feedback',

  // Onboarding guiado (Fase 4 — S4.2)
  ONBOARDING: 'Onboarding',
  ONBOARDING_WELCOME: 'OnboardingWelcome',
  ONBOARDING_MEDICINE: 'OnboardingMedicine',
  ONBOARDING_TREATMENT: 'OnboardingTreatment',
  ONBOARDING_STOCK: 'OnboardingStock',
  ONBOARDING_STOCK_INITIAL_BALANCE: 'OnboardingStockInitialBalance', // F4b/T017

  // Sub-rotas de Medicamentos (Fase 1)
  MEDICINES_LIST: 'MedicinesList',
  MEDICINE_CREATE: 'MedicineCreate',
  MEDICINE_EDIT: 'MedicineEdit',
  MEDICINE_DETAIL: 'MedicineDetail',

  // Sub-rotas de Estoque (Fase 3)
  STOCK_MAIN: 'StockMain',                 // renomeada de STOCK pra hub
  STOCK_DETAIL: 'StockDetail',
  PURCHASE_FORM: 'PurchaseForm',           // mode prop: 'create' | 'edit'
  PURCHASE_HISTORY: 'PurchaseHistory',
  STOCK_ADJUSTMENT: 'StockAdjustment',
  // ❌ PURCHASE_DELETE removido (PO-1 — Fase 3 não tem exclusão de compra)

  // Saldo inicial na ativação do estoque (spec 044, F4b/T017) — 3 entradas: Settings
  // (registrada no ProfileStack e no StockStack), Onboarding (rota própria acima) e
  // upsell do dashboard (mesma rota, param `source`).
  STOCK_INITIAL_BALANCE: 'StockInitialBalance',

  // Histórico de doses (Fase X)
  DOSE_HISTORY: 'DoseHistory',

  // Área de Medidas / biomarcadores (012 Fase C)
  MEASURES: 'Measures',

  // Chat IA (spec 015 onda 2) — tela full-screen via stack
  CHAT: 'Chat',

  // Dev-only (apenas __DEV__)
  DEV_HUB: 'DevHub',
  STOCK_PRIMITIVES_DEMO: 'StockPrimitivesDemo',
  DOSE_PRIMITIVES_DEMO: 'DosePrimitivesDemo',
}
