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
  getStartOfDayISO,
  getEndOfDayISO,
  addMonths,
  cloneDate,
  getLastDayOfMonth,
  parseLocalDatetime,
  parseTimestamp,
} from './dateUtils.js'

// Adherence logic and calculations
export {
  calculateExpectedDoses,
  calculateAdherenceStats,
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
} from './adherenceLogic.js'

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
