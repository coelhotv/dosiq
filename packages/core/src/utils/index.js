/**
 * Utilitarios Puros Compartilhados - Dosiq
 *
 * Este modulo exporta funcoes utilitarias puras que nao dependem de APIs do navegador,
 * variaveis de ambiente ou estado global. Seguro para uso em qualquer contexto:
 * web, mobile, Node.js, Tauri, etc.
 */

// Date utilities
export {
  parseLocalDate,
  formatLocalDate,
  getTodayLocal,
  getYesterdayLocal,
  addDays,
  daysDifference,
  getPeriodFromTime,
  getNow,
  getRawNow,
  getServerTimestamp,
  parseISO,
  getSaoPauloTime,
  getUserTime,
  getStartOfDayISO,
  getEndOfDayISO,
  addMonths,
  cloneDate,
  getLastDayOfMonth,
  parseLocalDatetime,
  parseTimestamp,
  // Verifica APENAS validade de período (start_date/end_date). NÃO checa
  // frequency/weekdays — use isProtocolActiveOnDate (adherenceLogic) para
  // contexto de schedule/adesão. Exportado com nome explícito para
  // diferenciar do strict adherence-aware.
  isProtocolActiveOnDate as isProtocolInPeriod,
} from './dateUtils.js'

// Adherence logic and calculations
export {
  calculateExpectedDoses,
  isProtocolFollowed,
  isDoseInToleranceWindow,
  getNextDoseTime,
  getNextDoseWindowEnd,
  isInToleranceWindow,
  calculateDailyIntake,
  calculateDaysRemaining,
  doseToMl,
  frequencyDailyFactor,
  calculateDosesByDate,
  evaluateDoseTimelineState,
  isProtocolActiveOnDate,
  getProtocolDays,
  getDailyDoseRate,
  // Leitura de adesão a partir de dose_instances (Fase 3 — ADR-048/050/052)
  computeAdherenceFromInstances,
  computeStreakFromInstances,
  computeLongestStreakFromInstances,
  ADHERENCE_MODE,
  INSTANCE_STATUS,
} from './adherenceLogic.js'

// Dose instance generation engine (ADR-048, Fase 2)
export {
  generateInstances,
} from './doseInstanceGenerator.js'

// Form utilities
export {
  getFieldDescribedBy,
  coerceDecimal,
  cleanFloat,
} from './formUtils.js'

// String utilities
export {
  toSentenceCase,
  toTitleCase,
} from './stringUtils.js'

// Titration utilities
export {
  calculateTitrationData,
  resolveTitrationStageAt,
} from './titrationUtils.js'

// Notification utilities
export {
  getNotificationIcon,
  formatRelativeTime,
} from './notificationIconMapper.js'

// Dose unit presentation (Fase 2)
export {
  pluralizeDoseUnit,
  formatDoseUnit,
  formatDose,
  formatNumberPtBR,
  formatIntakeDose,
  formatDoseItem,
  formatDoseHint,
  formatConcentration,
  formatMedicineConcentration,
  formatActiveIngredientHint,
  formatActiveIngredientFormula,
  formatActiveIngredientShort,
  isLiquidMedicine,
  stockUnitLabel,
  formatStockCount,
  formatStockQuantity,
  formatConcentrationLabel,
  formatStockApplications,
  densityFor,
} from './doseUnit.js'

// Date presentation PT-BR (Fase 2)
export {
  formatDatePtBR,
  formatDateShortPtBR,
  formatEndDate,
  formatTimePtBR,
  formatDateTimePtBR,
  formatDateTimeShortPtBR,
} from './dateFormat.js'

// Treatment status resolver (Fase 2.5 — paridade web↔mobile)
export {
  TREATMENT_STATUS,
  resolveTreatmentStatus,
} from './treatmentStatus.js'

// Prescription vigência status resolver (038 Slice C — paridade web↔mobile)
export {
  PRESCRIPTION_STATUS,
  PRESCRIPTION_EXPIRY_WARNING_DAYS,
  derivePrescriptionStatus,
} from './prescriptionStatus.js'

// Stock helpers (Fase 3 — paridade web↔mobile)
// REUSA calculateDailyIntake + calculateDaysRemaining de adherenceLogic.js
// (exportados acima) — não duplicar derivações de consumo/dias-restantes.
export {
  STOCK_STATUS,
  STOCK_THRESHOLDS,
  resolveStockStatus,
  stockDoseMetrics,
  computeAverageUnitPrice,
  computeExpiryDays,
  isBiologicallyExpired,
  biologicalExpiryDaysLeft,
  formatBRL,
} from './stock.js'

// Ícone de identificação do medicamento (012 Fase A — fonte única, binding por plataforma)
export {
  getMedicineIconName,
  MEDICINE_ICON_BY_PRESENTATION,
  SUPPLEMENT_ICON,
} from './medicineIcon.js'

export { calculateAge, getInitials } from './profile.js'

// Timeline event-model + builder puro (Fase 4 — FP-3 / ADR-050)
export {
  TIMELINE_EVENT_TYPES,
  TIMELINE_ORDER,
  buildTimeline,
  groupByLocalDay,
  deriveLocalDay,
} from './timeline.js'

// Zonas de dose — classificação temporal + DoseItems de dose_instances
// (Fase 4 / F4.3a — CON-024, compartilhado web↔mobile)
export {
  DEFAULT_TZ,
  classifyDose,
  buildDoseItemsFromInstances,
  splitDayTimeline,
  daysAgoLabel,
} from './doseZones.js'

// Sítios de injeção — locais corporais de aplicação + rotação (031, ADR-072)
export {
  INJECTION_SITES,
  INJECTION_SITE_VALUES,
  getInjectionSiteLabel,
  getInjectionSiteAbsorption,
  isInjectable,
} from './injectionSites.js'

// SemVer utilities (026 — Nudges In-App)
export { compareSemver, satisfiesSemver } from './semver.js'

// Nudge scheduler — lógica pura de seleção/filtragem (026)
export {
  dismissKey,
  buildNudgeList,
} from './nudgeScheduler.js'

// Formatação de biomarcador — valor composto (PA "S por D") + label de contexto (032)
export {
  formatBiomarkerDisplay,
  formatBiomarkerContext,
  biomarkerCardLabel,
} from './biomarkerDisplay.js'
