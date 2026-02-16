/**
 * API Services Barrel Export
 *
 * This file re-exports all services from their individual modules.
 * This allows existing imports to work without changes:
 *
 * Before: import { medicineService, protocolService } from '../services/api'
 * After:  import { medicineService, protocolService } from '@shared/services' (unchanged)
 *
 * CACHE SWR (v1.5):
 * - cached* services fornecem cache automático com invalidação
 * - use useCachedQuery hook para integração React
 * - Original services mantidos para compatibilidade
 */

// Services originais (mantidos para compatibilidade)
export { medicineService } from '@medications/services/medicineService'
export { protocolService } from '@protocols/services/protocolService'
export { treatmentPlanService } from '@protocols/services/treatmentPlanService'
export { stockService } from '@stock/services/stockService'
export { logService } from '@shared/services/api/logService'
export { migrationService } from '@shared/services/migrationService'
export { adherenceService } from '@adherence/services/adherenceService'

// Services com cache SWR (recomendado para novos usos)
export {
  cachedMedicineService,
  cachedProtocolService,
  cachedStockService,
  cachedLogService,
  cachedTreatmentPlanService,
  cachedServices,
  CACHE_KEYS,
} from '@shared/services/cachedServices'
