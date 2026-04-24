/**
 * Cache Keys — chaves canônicas do projeto (fonte única de verdade)
 *
 * Todos os callers (cachedServices, hooks, componentes) devem importar daqui.
 * Chaves identicas em multiplos lugares causam falhas silenciosas de invalidacao.
 *
 * Valores sao os mesmos que estavam em cachedServices.js — migrados para cá
 * para centralizar e eliminar duplicacao (H3.3, Wave H3).
 *
 * Uso:
 *   import { CACHE_KEYS } from '@dosiq/shared-data'
 *   const key = CACHE_KEYS.MEDICINES
 */

export const CACHE_KEYS = {
  // Medicamentos
  MEDICINES: 'medicines',
  MEDICINE_BY_ID: 'medicine',

  // Protocolos
  PROTOCOLS: 'protocols',
  PROTOCOLS_ACTIVE: 'protocols:active',
  PROTOCOL_BY_ID: 'protocol',

  // Estoque
  STOCK_BY_MEDICINE: 'stock:medicine',
  STOCK_TOTAL: 'stock:total',
  STOCK_SUMMARY: 'stock:summary',
  STOCK_LOW: 'stock:low',

  // Compras
  PURCHASES_BY_MEDICINE: 'purchases:medicine',
  PURCHASES_HISTORY: 'purchases:history',
  PURCHASES_LATEST: 'purchases:latest',
  PURCHASES_AVG_PRICE: 'purchases:avgPrice',

  // Logs
  LOGS: 'logs',
  LOGS_BY_PROTOCOL: 'logs:protocol',
  LOGS_BY_MONTH: 'logs:month',
  LOGS_PAGINATED: 'logs:paginated',
  LOGS_PAGINATED_SLIM: 'logs:paginatedSlim',
  LOGS_DATE_RANGE_SLIM: 'logs:dateRangeSlim',
  LOGS_BY_MONTH_SLIM: 'logs:monthSlim',

  // Planos de tratamento
  TREATMENT_PLANS: 'treatmentPlans',
  TREATMENT_PLAN_BY_ID: 'treatmentPlan',

  // Aderência
  ADHERENCE_SUMMARY: 'adherence:summary',
  ADHERENCE_DAILY: 'adherence:daily',
  ADHERENCE_PATTERN: 'adherence:pattern',

  // Usuário / Sessão
  USER_CURRENT: 'user:current',
  USER_SESSION: 'user:session',

  // Notificações
  NOTIFICATIONS: 'notifications',
  NOTIFICATIONS_PAGINATED: 'notifications:paginated',

  // Dashboard
  DASHBOARD_INSIGHTS: 'dashboard:insights',
}

/**
 * Gera uma chave de cache composta com base em uma chave base e parâmetros.
 * Util para chaves dinâmicas nao cobertas pelas constantes acima.
 *
 * @param {string} baseKey - Chave base
 * @param {Object|null} params - Parâmetros opcionais para compor a chave
 * @returns {string} Chave composta
 */
export function generateCacheKey(baseKey, params = null) {
  if (!params) return baseKey
  const suffix = JSON.stringify(params, Object.keys(params).sort())
  return `${baseKey}:${suffix}`
}
