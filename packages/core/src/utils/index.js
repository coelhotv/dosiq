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
} from './formUtils.js'

// String utilities
export {
  toSentenceCase,
  toTitleCase,
} from './stringUtils.js'

// Titration utilities
export {
  calculateTitrationData,
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
  formatActiveIngredientHint,
  formatActiveIngredientFormula,
  formatActiveIngredientShort,
} from './doseUnit.js'

// Date presentation PT-BR (Fase 2)
export {
  formatDatePtBR,
  formatDateShortPtBR,
  formatEndDate,
} from './dateFormat.js'

// Treatment status resolver (Fase 2.5 — paridade web↔mobile)
export {
  TREATMENT_STATUS,
  resolveTreatmentStatus,
} from './treatmentStatus.js'

// Stock helpers (Fase 3 — paridade web↔mobile)
// REUSA calculateDailyIntake + calculateDaysRemaining de adherenceLogic.js
// (exportados acima) — não duplicar derivações de consumo/dias-restantes.
export {
  STOCK_STATUS,
  STOCK_THRESHOLDS,
  resolveStockStatus,
  computeAverageUnitPrice,
  computeExpiryDays,
  formatBRL,
} from './stock.js'

export { calculateAge, getInitials } from './profile.js'

// Timeline event-model + builder puro (Fase 4 — FP-3 / ADR-050)
export {
  TIMELINE_EVENT_TYPES,
  TIMELINE_ORDER,
  buildTimeline,
  groupByLocalDay,
  deriveLocalDay,
} from './timeline.js'
