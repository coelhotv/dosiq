// routes.js — registro canônico de nomes de rota do app mobile
// R5-009: rotas NÃO devem ser strings espalhadas pelo app
// Importar sempre deste módulo para evitar inconsistências

export const ROUTES = {
  // Raiz auth-aware
  SMOKE: 'Smoke',
  LOGIN: 'Login',

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
}
