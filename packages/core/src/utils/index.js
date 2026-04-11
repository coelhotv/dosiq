/**
 * Utilitarios Puros Compartilhados - Meus Remedios
 *
 * Este modulo exporta funcoes utilitarias puras que nao dependem de APIs do navegador,
 * variaveis de ambiente ou estado global. Seguro para uso em qualquer contexto:
 * web, mobile, Node.js, Tauri, etc.
 */

// Date utilities
export {
  parseLocalDate,
  formatLocalDate,
  isProtocolActiveOnDate,
  getTodayLocal,
  getYesterdayLocal,
  addDays,
  daysDifference,
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
