/**
 * API Services Barrel Export
 *
 * This file re-exports all services from their individual modules.
 * This allows existing imports to work without changes:
 *
 * Before: import { medicineService, protocolService } from '../services/api'
 * After:  import { medicineService, protocolService } from '../services/api' (unchanged)
 *
 * CACHE SWR (v1.5):
 * - cached* services fornecem cache automático com invalidação
 * - use useCachedQuery hook para integração React
 * - Original services mantidos para compatibilidade
 */

// Services originais (mantidos para compatibilidade)
export { medicineService } from './medicineService'
export { protocolService } from './protocolService'
export { treatmentPlanService } from './treatmentPlanService'
export { stockService } from './stockService'
export { logService } from './logService'
export { migrationService } from './migrationService'
export { adherenceService } from './adherenceService'

// Services com cache SWR (recomendado para novos usos)
export {
  cachedMedicineService,
  cachedProtocolService,
  cachedStockService,
  cachedLogService,
  cachedTreatmentPlanService,
  cachedServices,
  CACHE_KEYS,
} from './cachedServices'
