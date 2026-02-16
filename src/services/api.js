/**
 * API Services - Backward Compatibility Layer
 *
 * This file maintains backward compatibility with existing imports.
 * All services have been modularized into separate files in the api/ directory.
 *
 * Old imports: import { medicineService } from '../services/api'
 * Still work thanks to this re-export.
 *
 * For new code, you can import from specific modules:
 * import { medicineService } from '../services/api/medicineService'
 */

export { medicineService } from './api/medicineService'
export { protocolService } from './api/protocolService'
export { treatmentPlanService } from './api/treatmentPlanService'
export { stockService } from './api/stockService'
export { logService } from './api/logService'
export { migrationService } from './api/migrationService'
export { adherenceService } from './api/adherenceService'

// Re-export cached services para compatibilidade
export {
  cachedMedicineService,
  cachedProtocolService,
  cachedStockService,
  cachedLogService,
  cachedTreatmentPlanService,
  CACHE_KEYS,
} from './api/cachedServices'
