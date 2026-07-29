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
  normalizeRegulatoryCategory,
} from './medicineSchema'

export {
  protocolSchema,
  protocolCreateSchema,
  protocolUpdateSchema,
  protocolFullSchema,
  validateProtocol,
  validateProtocolCreate,
  validateProtocolUpdate,
  mapProtocolErrorsToForm,
  getProtocolErrorMessage,
  FREQUENCIES,
  FREQUENCY_LABELS,
  INTAKE_UNITS,
  INTAKE_UNIT_LABELS,
  WEEKDAYS,
  WEEKDAY_LABELS,
} from './protocolSchema'

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
} from './stockSchema'

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
} from './logSchema'
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
  BIOMARKER_PA_CONTEXTS,
  BIOMARKER_PA_CONTEXT_LABELS,
  BIOMARKER_ALL_CONTEXTS,
  BIOMARKER_CONTEXTS_BY_TYPE,
  BIOMARKER_SOURCES,
} from './biomarkerLogSchema'

export {
  geminiReviewSchema,
  validateGeminiReview,
} from './geminiReviewSchema'

export {
  notificationLogSchema,
  notificationLogCreateSchema,
} from './notificationLogSchema'

export {
  NOTIFICATION_TYPES,
  DOSE_RELATED_NOTIFICATION_TYPES,
  notificationSchema,
  notificationListSchema,
} from './notificationSchema'

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
} from './emergencyCardSchema'

export {
  validatePasswordChange,
} from './authSchema'

export {
  AnalyzeAdherencePatternsInputSchema,
  AnalyzeAdherencePatternsOutputSchema,
  validateAnalyzeAdherencePatternsInput,
  validateAnalyzeAdherencePatternsOutput,
} from './adherencePatternSchema'

export {
  CalculateMonthlyCostsInputSchema,
  CalculateDailyIntakeInputSchema,
  CalculateAvgUnitPriceInputSchema,
  CalculateRealCostsInputSchema,
} from './costAnalysisSchema'

export {
  AnalyzeReminderTimingInputSchema,
  ReminderSuggestionSchema,
} from './reminderOptimizerSchema'

export {
  default as userProfileSchema,
  validateUserProfile,
  BRAZILIAN_STATES,
} from './userProfileSchema'

export {
  userSettingsNotificationSchema,
  NOTIFICATION_MODES,
  TIMEZONES_BR,
  TIMEZONE_OPTIONS,
  DEFAULT_TIMEZONE,
  getDeviceTimezone,
  resolveSupportedTz,
  deriveLegacyPreference,
} from './userSettingsSchema'

export {
  default as feedbackSchema,
  validateFeedbackCreate,
} from './feedbackSchema'

// Helper geral de validação
export { validateEntity, ValidationError } from './validationHelper'

// Audit trail de dose crítica (spec 042 — CON-031)
export {
  default as criticalAuditEventSchema,
  CRITICAL_AUDIT_EVENTS,
  CRITICAL_AUDIT_PLATFORMS,
  CRITICAL_AUDIT_ACTORS,
} from './criticalAuditEventSchema'

// Consentimento LGPD (spec 046 — copy canônica do opt-in + vocabulário da trilha)
export {
  default as consentEventSchema,
  CONSENT_TYPES,
  CONSENT_ACTIONS,
  CONSENT_PLATFORMS,
  CONSENT_STATUSES,
  CURRENT_POLICY_VERSION,
  HEALTH_CONSENT_COPY,
  deriveConsentState,
} from './consentSchema'
export type {
  ConsentType,
  ConsentAction,
  ConsentPlatform,
  ConsentStatus,
  ConsentEvent,
  ConsentState,
} from './consentSchema'

// Evolução do tratamento / titulação N2 (spec 029 — ADR-080; modelo titrations + titration_steps)
export {
  default as titrationSchema,
  titrationStepSchema,
  titrationCreateSchema,
  titrationStepCreateSchema,
  validateTitrationStep,
  TITRATION_INTAKE_UNITS,
  TITRATION_STEP_STATUSES,
} from './titrationSchema'
export type {
  Titration,
  TitrationStep,
  TitrationCreate,
  TitrationStepCreate,
  TitrationIntakeUnit,
  TitrationStepStatus,
} from './titrationSchema'

// Kill switch de versão mínima — schema de ESCRITA + allowlist de store_url (051 / ADR-091 / CON-033).
// A allowlist é CONTROLE DE SEGURANÇA (S-8) e vive só aqui: handler admin e cliente mobile consomem
// esta definição, nunca uma cópia.
export {
  default as versionGateUpdateSchema,
  versionGateUpdateSchema as versionGateSchema,
  validateVersionGateUpdate,
  isAllowedStoreUrl,
  VERSION_GATE_PLATFORMS,
  STORE_URL_ALLOWLIST,
  GATE_MESSAGE_MAX_LENGTH,
  VERSION_GATE_CLIENT_COLUMNS,
} from './versionGateSchema'
export type {
  VersionGatePlatform,
  VersionGateUpdateInput,
} from './versionGateSchema'
