/**
 * Schemas de Validação Zod - Dosiq
 *
 * Este módulo exporta todos os schemas de validação e helpers
 * para validação de dados da aplicação.
 */

// Schemas individuais
export {
  medicineSchema,
  medicineCreateSchema,
  medicineUpdateSchema,
  medicineFullSchema,
  validateMedicine,
  validateMedicineCreate,
  validateMedicineUpdate,
  mapMedicineErrorsToForm,
  getMedicineErrorMessage,
} from './medicineSchema.js'

export {
  protocolSchema,
  protocolCreateSchema,
  protocolUpdateSchema,
  protocolFullSchema,
  titrationStageSchema,
  validateProtocol,
  validateProtocolCreate,
  validateProtocolUpdate,
  validateTitrationStage,
  mapProtocolErrorsToForm,
  getProtocolErrorMessage,
} from './protocolSchema.js'

export {
  stockSchema,
  stockCreateSchema,
  stockUpdateSchema,
  stockFullSchema,
  stockDecreaseSchema,
  stockIncreaseSchema,
  validateStock,
  validateStockCreate,
  validateStockUpdate,
  validateStockDecrease,
  validateStockIncrease,
  mapStockErrorsToForm,
  getStockErrorMessage,
} from './stockSchema.js'

export {
  logSchema,
  logCreateSchema,
  logUpdateSchema,
  logFullSchema,
  logBulkCreateSchema,
  validateLog,
  validateLogCreate,
  validateLogUpdate,
  validateLogBulkCreate,
  validateLogBulkArray,
  mapLogErrorsToForm,
  mapBulkLogErrors,
  getLogErrorMessage,
  getBulkLogErrorMessage,
} from './logSchema.js'

export {
  geminiReviewSchema,
  geminiReviewCreateSchema,
  geminiReviewUpdateSchema,
  geminiReviewStatusUpdateSchema,
  geminiReviewFiltersSchema,
  geminiReviewFullSchema,
  validateGeminiReview,
  validateGeminiReviewCreate,
  validateGeminiReviewUpdate,
  validateGeminiReviewStatusUpdate,
  validateGeminiReviewFilters,
  mapGeminiReviewErrorsToForm,
  getGeminiReviewErrorMessage,
  getStatusLabel,
  getPriorityLabel,
  getCategoryLabel,
  isFinalStatus,
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_PRIORITIES,
  REVIEW_PRIORITY_LABELS,
  REVIEW_CATEGORIES,
  REVIEW_CATEGORY_LABELS,
} from './geminiReviewSchema.js'

export {
  notificationLogSchema,
  notificationLogCreateSchema,
} from './notificationLogSchema.js'

export {
  userSettingsNotificationSchema,
  NOTIFICATION_MODES,
  deriveLegacyPreference,
} from './userSettingsSchema.js'

// Helper geral de validação
export { validateEntity, ValidationError } from './validationHelper.js'
