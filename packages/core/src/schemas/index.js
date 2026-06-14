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
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  MEDICINE_TYPES,
  MEDICINE_TYPE_LABELS,
  PRESENTATIONS,
  PRESENTATION_LABELS,
  LIQUID_PRESENTATIONS,
  INJECTION_CONTAINERS,
  INJECTION_CONTAINER_LABELS,
  INJECTION_CONTAINER_SINGULAR,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
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
  FREQUENCIES,
  FREQUENCY_LABELS,
  INTAKE_UNITS,
  INTAKE_UNIT_LABELS,
  WEEKDAYS,
  WEEKDAY_LABELS,
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
  biomarkerLogSchema,
  biomarkerLogCreateSchema,
  biomarkerLogUpdateSchema,
  biomarkerLogFullSchema,
  validateBiomarkerLog,
  validateBiomarkerLogUpdate,
  BIOMARKER_TYPES,
  BIOMARKER_TYPE_LABELS,
  BIOMARKER_TYPE_UNITS,
  BIOMARKER_CONTEXTS,
  BIOMARKER_CONTEXT_LABELS,
  BIOMARKER_SOURCES,
} from './biomarkerLogSchema.js'

export {
  geminiReviewSchema,
  validateGeminiReview,
} from './geminiReviewSchema.js'

export {
  notificationLogSchema,
  notificationLogCreateSchema,
} from './notificationLogSchema.js'

export {
  NOTIFICATION_TYPES,
  DOSE_RELATED_NOTIFICATION_TYPES,
  notificationSchema,
  notificationListSchema,
} from './notificationSchema.js'

export {
  emergencyCardSchema,
  emergencyCardCreateSchema,
  emergencyCardUpdateSchema,
  emergencyCardFullSchema,
  validateEmergencyCard,
  validateEmergencyCardCreate,
  validateEmergencyCardUpdate,
  validateEmergencyContact,
  mapEmergencyCardErrorsToForm,
  getEmergencyCardErrorMessage,
} from './emergencyCardSchema.js'

export {
  validatePasswordChange,
} from './authSchema.js'

export {
  AnalyzeAdherencePatternsInputSchema,
  AnalyzeAdherencePatternsOutputSchema,
  validateAnalyzeAdherencePatternsInput,
  validateAnalyzeAdherencePatternsOutput,
} from './adherencePatternSchema.js'

export {
  CalculateMonthlyCostsInputSchema,
  CalculateDailyIntakeInputSchema,
  CalculateAvgUnitPriceInputSchema,
  CalculateRealCostsInputSchema,
} from './costAnalysisSchema.js'

export {
  AnalyzeReminderTimingInputSchema,
  ReminderSuggestionSchema,
} from './reminderOptimizerSchema.js'

export {
  default as userProfileSchema,
  validateUserProfile,
  BRAZILIAN_STATES,
} from './userProfileSchema.js'

export {
  userSettingsNotificationSchema,
  NOTIFICATION_MODES,
  TIMEZONES_BR,
  TIMEZONE_OPTIONS,
  DEFAULT_TIMEZONE,
  getDeviceTimezone,
  resolveSupportedTz,
  deriveLegacyPreference,
} from './userSettingsSchema.js'

export {
  default as feedbackSchema,
  validateFeedbackCreate,
} from './feedbackSchema.js'

// Helper geral de validação
export { validateEntity, ValidationError } from './validationHelper.js'
