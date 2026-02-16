/**
 * Cached Services - Wrappers com cache SWR para os services da API
 *
 * Este arquivo fornece versões cacheadas dos métodos de leitura dos services,
 * mantendo a API original intacta para compatibilidade.
 *
 * As mutations (create/update/delete) automaticamente invalidam o cache
 * relevante após sucesso.
 *
 * @module cachedServices
 */

import { cachedQuery, invalidateCache, generateCacheKey } from '@shared/utils/queryCache'
import { medicineService } from '@medications/services/medicineService'
import { protocolService } from '@protocols/services/protocolService'
import { stockService } from '@stock/services/stockService'
import { logService } from '@shared/services/api/logService'
import { treatmentPlanService } from '@protocols/services/treatmentPlanService'

// Cache keys namespace
export const CACHE_KEYS = {
  MEDICINES: 'medicines',
  MEDICINE_BY_ID: 'medicine',
  PROTOCOLS: 'protocols',
  PROTOCOLS_ACTIVE: 'protocols:active',
  PROTOCOL_BY_ID: 'protocol',
  STOCK_BY_MEDICINE: 'stock:medicine',
  STOCK_TOTAL: 'stock:total',
  STOCK_SUMMARY: 'stock:summary',
  STOCK_LOW: 'stock:low',
  LOGS: 'logs',
  LOGS_BY_PROTOCOL: 'logs:protocol',
  LOGS_BY_MONTH: 'logs:month',
  LOGS_PAGINATED: 'logs:paginated',
  TREATMENT_PLANS: 'treatmentPlans',
  TREATMENT_PLAN_BY_ID: 'treatmentPlan',
}

/**
 * Medicine Service com Cache
 */
export const cachedMedicineService = {
  // Métodos de leitura (com cache)
  async getAll() {
    return cachedQuery(CACHE_KEYS.MEDICINES, () => medicineService.getAll())
  },

  async getById(id) {
    const key = generateCacheKey(CACHE_KEYS.MEDICINE_BY_ID, { id })
    return cachedQuery(key, () => medicineService.getById(id))
  },

  // Métodos de escrita (com invalidação de cache)
  async create(medicine) {
    const result = await medicineService.create(medicine)
    // Invalida lista de medicamentos
    invalidateCache(CACHE_KEYS.MEDICINES)
    console.log('[cachedMedicineService] Cache invalidado após create')
    return result
  },

  async update(id, updates) {
    const result = await medicineService.update(id, updates)
    // Invalida lista e item específico
    invalidateCache(CACHE_KEYS.MEDICINES)
    invalidateCache(generateCacheKey(CACHE_KEYS.MEDICINE_BY_ID, { id }))
    // Também invalida estoque relacionado (preço pode ter mudado)
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}:*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}:*`)
    console.log('[cachedMedicineService] Cache invalidado após update')
    return result
  },

  async delete(id) {
    await medicineService.delete(id)
    // Invalida lista e item específico
    invalidateCache(CACHE_KEYS.MEDICINES)
    invalidateCache(generateCacheKey(CACHE_KEYS.MEDICINE_BY_ID, { id }))
    // Invalida estoque relacionado
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}:*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}:*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}:*`)
    console.log('[cachedMedicineService] Cache invalidado após delete')
  },
}

/**
 * Protocol Service com Cache
 */
export const cachedProtocolService = {
  // Métodos de leitura (com cache)
  async getAll() {
    return cachedQuery(CACHE_KEYS.PROTOCOLS, () => protocolService.getAll())
  },

  async getActive() {
    return cachedQuery(CACHE_KEYS.PROTOCOLS_ACTIVE, () => protocolService.getActive())
  },

  async getById(id) {
    const key = generateCacheKey(CACHE_KEYS.PROTOCOL_BY_ID, { id })
    return cachedQuery(key, () => protocolService.getById(id))
  },

  async getByMedicineId(medicineId) {
    const key = generateCacheKey('protocols:medicine', { medicineId })
    return cachedQuery(key, () => protocolService.getByMedicineId(medicineId))
  },

  // Métodos de escrita (com invalidação de cache)
  async create(protocol) {
    const result = await protocolService.create(protocol)
    // Invalida todas as listas de protocolos
    invalidateCache(`${CACHE_KEYS.PROTOCOLS}*`)
    // Invalida planos de tratamento (podem conter protocolos)
    invalidateCache(`${CACHE_KEYS.TREATMENT_PLANS}*`)
    console.log('[cachedProtocolService] Cache invalidado após create')
    return result
  },

  async update(id, updates) {
    const result = await protocolService.update(id, updates)
    // Invalida todas as listas e item específico
    invalidateCache(`${CACHE_KEYS.PROTOCOLS}*`)
    invalidateCache(generateCacheKey(CACHE_KEYS.PROTOCOL_BY_ID, { id }))
    // Invalida planos de tratamento
    invalidateCache(`${CACHE_KEYS.TREATMENT_PLANS}*`)
    console.log('[cachedProtocolService] Cache invalidado após update')
    return result
  },

  async delete(id) {
    await protocolService.delete(id)
    // Invalida todas as listas e item específico
    invalidateCache(`${CACHE_KEYS.PROTOCOLS}*`)
    invalidateCache(generateCacheKey(CACHE_KEYS.PROTOCOL_BY_ID, { id }))
    // Invalida planos de tratamento e logs relacionados
    invalidateCache(`${CACHE_KEYS.TREATMENT_PLANS}*`)
    invalidateCache(`${CACHE_KEYS.LOGS}*`)
    console.log('[cachedProtocolService] Cache invalidado após delete')
  },
}

/**
 * Stock Service com Cache
 */
export const cachedStockService = {
  // Métodos de leitura (com cache)
  async getByMedicine(medicineId) {
    const key = generateCacheKey(CACHE_KEYS.STOCK_BY_MEDICINE, { medicineId })
    return cachedQuery(key, () => stockService.getByMedicine(medicineId))
  },

  async getTotalQuantity(medicineId) {
    const key = generateCacheKey(CACHE_KEYS.STOCK_TOTAL, { medicineId })
    return cachedQuery(key, () => stockService.getTotalQuantity(medicineId))
  },

  async getStockSummary(medicineId) {
    const key = generateCacheKey(CACHE_KEYS.STOCK_SUMMARY, { medicineId })
    return cachedQuery(key, () => stockService.getStockSummary(medicineId))
  },

  async getLowStockMedicines(threshold = 10) {
    const key = generateCacheKey(CACHE_KEYS.STOCK_LOW, { threshold })
    return cachedQuery(key, () => stockService.getLowStockMedicines(threshold))
  },

  // Métodos de escrita (com invalidação de cache)
  async add(stock) {
    const result = await stockService.add(stock)
    // Invalida estoque do medicamento específico
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_LOW}*`)
    // Invalida medicamentos (preço médio pode mudar)
    invalidateCache(CACHE_KEYS.MEDICINES)
    console.log('[cachedStockService] Cache invalidado após add')
    return result
  },

  async update(id, updates) {
    const result = await stockService.update(id, updates)
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_LOW}*`)
    invalidateCache(CACHE_KEYS.MEDICINES)
    console.log('[cachedStockService] Cache invalidado após update')
    return result
  },

  async delete(id) {
    await stockService.delete(id)
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_LOW}*`)
    invalidateCache(CACHE_KEYS.MEDICINES)
    console.log('[cachedStockService] Cache invalidado após delete')
  },

  async decrease(medicineId, quantity) {
    const result = await stockService.decrease(medicineId, quantity)
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_LOW}*`)
    invalidateCache(CACHE_KEYS.MEDICINES)
    console.log('[cachedStockService] Cache invalidado após decrease')
    return result
  },

  async increase(medicineId, quantity, options) {
    const result = await stockService.increase(medicineId, quantity, options)
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_LOW}*`)
    invalidateCache(CACHE_KEYS.MEDICINES)
    console.log('[cachedStockService] Cache invalidado após increase')
    return result
  },
}

/**
 * Log Service com Cache
 */
export const cachedLogService = {
  // Métodos de leitura (com cache)
  async getAll(limit = 50) {
    const key = generateCacheKey(CACHE_KEYS.LOGS, { limit })
    return cachedQuery(key, () => logService.getAll(limit))
  },

  async getByProtocol(protocolId, limit = 50) {
    const key = generateCacheKey(CACHE_KEYS.LOGS_BY_PROTOCOL, { protocolId, limit })
    return cachedQuery(key, () => logService.getByProtocol(protocolId, limit))
  },

  async getByMonth(year, month) {
    const key = generateCacheKey(CACHE_KEYS.LOGS_BY_MONTH, { year, month })
    return cachedQuery(key, () => logService.getByMonth(year, month))
  },

  async getAllPaginated(limit, offset) {
    const key = generateCacheKey(CACHE_KEYS.LOGS_PAGINATED, { limit, offset })
    return cachedQuery(key, () => logService.getAllPaginated(limit, offset))
  },

  async getByDateRange(startDate, endDate, limit = 50, offset = 0) {
    const key = generateCacheKey('logs:dateRange', { startDate, endDate, limit, offset })
    return cachedQuery(key, () => logService.getByDateRange(startDate, endDate, limit, offset))
  },

  // Métodos de escrita (com invalidação de cache)
  async create(log) {
    const result = await logService.create(log)
    // Invalida todas as queries de logs
    invalidateCache(`${CACHE_KEYS.LOGS}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_PROTOCOL}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_MONTH}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_PAGINATED}*`)
    invalidateCache('logs:dateRange*')
    // Invalida estoque (foi decrementado)
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_LOW}*`)
    console.log('[cachedLogService] Cache invalidado após create')
    return result
  },

  async createBulk(logs) {
    const result = await logService.createBulk(logs)
    invalidateCache(`${CACHE_KEYS.LOGS}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_PROTOCOL}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_MONTH}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_PAGINATED}*`)
    invalidateCache('logs:dateRange*')
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_LOW}*`)
    console.log('[cachedLogService] Cache invalidado após createBulk')
    return result
  },

  async update(id, updates) {
    const result = await logService.update(id, updates)
    invalidateCache(`${CACHE_KEYS.LOGS}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_PROTOCOL}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_MONTH}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_PAGINATED}*`)
    invalidateCache('logs:dateRange*')
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    console.log('[cachedLogService] Cache invalidado após update')
    return result
  },

  async delete(id) {
    await logService.delete(id)
    invalidateCache(`${CACHE_KEYS.LOGS}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_PROTOCOL}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_BY_MONTH}*`)
    invalidateCache(`${CACHE_KEYS.LOGS_PAGINATED}*`)
    invalidateCache('logs:dateRange*')
    invalidateCache(`${CACHE_KEYS.STOCK_BY_MEDICINE}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_TOTAL}*`)
    invalidateCache(`${CACHE_KEYS.STOCK_SUMMARY}*`)
    console.log('[cachedLogService] Cache invalidado após delete')
  },
}

/**
 * Treatment Plan Service com Cache
 */
export const cachedTreatmentPlanService = {
  // Métodos de leitura (com cache)
  async getAll() {
    return cachedQuery(CACHE_KEYS.TREATMENT_PLANS, () => treatmentPlanService.getAll())
  },

  async getById(id) {
    const key = generateCacheKey(CACHE_KEYS.TREATMENT_PLAN_BY_ID, { id })
    return cachedQuery(key, () => treatmentPlanService.getById(id))
  },

  // Métodos de escrita (com invalidação de cache)
  async create(plan) {
    const result = await treatmentPlanService.create(plan)
    invalidateCache(`${CACHE_KEYS.TREATMENT_PLANS}*`)
    console.log('[cachedTreatmentPlanService] Cache invalidado após create')
    return result
  },

  async update(id, updates) {
    const result = await treatmentPlanService.update(id, updates)
    invalidateCache(`${CACHE_KEYS.TREATMENT_PLANS}*`)
    invalidateCache(generateCacheKey(CACHE_KEYS.TREATMENT_PLAN_BY_ID, { id }))
    console.log('[cachedTreatmentPlanService] Cache invalidado após update')
    return result
  },

  async delete(id) {
    await treatmentPlanService.delete(id)
    invalidateCache(`${CACHE_KEYS.TREATMENT_PLANS}*`)
    invalidateCache(generateCacheKey(CACHE_KEYS.TREATMENT_PLAN_BY_ID, { id }))
    console.log('[cachedTreatmentPlanService] Cache invalidado após delete')
  },
}

// Exporta todas as chaves de cache para uso externo
export { generateCacheKey, invalidateCache }

// Barrel export para conveniência
export const cachedServices = {
  medicineService: cachedMedicineService,
  protocolService: cachedProtocolService,
  stockService: cachedStockService,
  logService: cachedLogService,
  treatmentPlanService: cachedTreatmentPlanService,
}
