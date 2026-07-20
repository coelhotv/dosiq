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
  parseISOOrNull,
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
} from './dateUtils'

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
} from './adherenceLogic'
export type { AdherenceProtocol } from './adherenceLogic'

// Dose instance generation engine (ADR-048, Fase 2)
export {
  generateInstances,
} from './doseInstanceGenerator'

// Form utilities
export {
  getFieldDescribedBy,
  coerceDecimal,
  cleanFloat,
} from './formUtils'

// String utilities
export {
  toSentenceCase,
  toTitleCase,
} from './stringUtils'

// Titration utilities
// Legado N1 (jsonb em protocols) + adapter N2 (titration_steps, spec 029) + motor de avanço.
// O adapter e o motor são PUROS: quem busca as etapas é o chamador (cron/generator/UI).
export {
  calculateTitrationData,
  resolveTitrationStageAt,
  resolveTitrationAdvance,
  getEvolutionBadge,
  resolvePendingSwitch,
  resolveManualNextStep,
  resolveCurrentStep,
} from './titrationUtils'
export type {
  TitrationStepLike,
  TitrationStepEngineLike,
  TitrationStepPendingLike,
  PendingSwitchInfo,
  ManualNextStepInfo,
  TitrationAdvancePlan,
  TitrationStepTarget,
  TitrationStepClosure,
  EvolutionBadge,
  EvolutionBadgeKey,
} from './titrationUtils'

// Notification utilities
export {
  getNotificationIcon,
  formatRelativeTime,
} from './notificationIconMapper'

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
  formatMedicineFullName,
  formatActiveIngredientHint,
  formatActiveIngredientFormula,
  formatActiveIngredientShort,
  isLiquidMedicine,
  stockUnitLabel,
  formatStockCount,
  formatStockQuantity,
  formatConcentrationLabel,
  formatStockApplications,
  formatStockDoses,
  densityFor,
  doseToMl,
} from './doseUnit'

// Date presentation PT-BR (Fase 2)
export {
  formatDatePtBR,
  formatDateShortPtBR,
  formatEndDate,
  formatTimePtBR,
  formatDateTimePtBR,
  formatDateTimeShortPtBR,
} from './dateFormat'

// Treatment status resolver (Fase 2.5 — paridade web↔mobile)
export {
  TREATMENT_STATUS,
  resolveTreatmentStatus,
  isTreatmentActive,
  isTreatmentSchedulableOn,
} from './treatmentStatus'

// Prescription vigência status resolver (038 Slice C — paridade web↔mobile)
export {
  PRESCRIPTION_STATUS,
  PRESCRIPTION_EXPIRY_WARNING_DAYS,
  derivePrescriptionStatus,
} from './prescriptionStatus'

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
} from './stock'

// Ícone de identificação do medicamento (012 Fase A — fonte única, binding por plataforma)
export {
  getMedicineIconName,
  MEDICINE_ICON_BY_PRESENTATION,
  SUPPLEMENT_ICON,
} from './medicineIcon'

export { calculateAge, getInitials } from './profile'

// Timeline event-model + builder puro (Fase 4 — FP-3 / ADR-050)
export {
  TIMELINE_EVENT_TYPES,
  TIMELINE_ORDER,
  buildTimeline,
  groupByLocalDay,
  deriveLocalDay,
} from './timeline'

// Zonas de dose — classificação temporal + DoseItems de dose_instances
// (Fase 4 / F4.3a — CON-024, compartilhado web↔mobile)
export {
  DEFAULT_TZ,
  classifyDose,
  buildDoseItemsFromInstances,
  splitDayTimeline,
  daysAgoLabel,
} from './doseZones'

// Identidade do medicamento de uma ocorrência — fonte ÚNICA de leitura (spec 052 Slice B).
// Consome o snapshot `dose_instances.medicine_id` em vez do join `protocol_id → protocols`,
// que reescrevia o passado quando o medicamento do tratamento evoluía.
export {
  resolveInstanceMedicine,
  resolveInstanceMedicineId,
  buildMedicineIndex,
} from './instanceMedicine'

// Máquina de estados de dose — superfícies contínuas iOS/Android (Spec 039 / F1)
// Derivador + seletor de prioridade; aditivo a CON-024, novo CON candidato
export {
  DOSE_ACTIVITY_STATES,
  deriveDoseActivityState,
  selectActiveDoseActivity,
  doseActivityBoundaryTimes,
} from './doseActivityState'

// Sítios de injeção — locais corporais de aplicação + rotação (031, ADR-072)
export {
  INJECTION_SITES,
  INJECTION_SITE_VALUES,
  getInjectionSiteLabel,
  getInjectionSiteAbsorption,
  isInjectable,
} from './injectionSites'

// SemVer utilities (026 — Nudges In-App)
export { compareSemver, satisfiesSemver } from './semver'

// Nudge scheduler — lógica pura de seleção/filtragem (026)
export {
  dismissKey,
  buildNudgeList,
} from './nudgeScheduler'

// Formatação de biomarcador — valor composto (PA "S por D") + label de contexto (032)
export {
  formatBiomarkerDisplay,
  formatBiomarkerContext,
  biomarkerCardLabel,
} from './biomarkerDisplay'
