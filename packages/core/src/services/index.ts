// @dosiq/core services — orquestração (geração + persistência) reusável web/mobile/server.
export {
  WINDOW_DAYS,
  RENEWAL_THRESHOLD_DAYS,
  computeWindowEnd,
  planWindow,
  ensureInstancesUpTo,
  resyncProtocolWindow,
  renewProtocolWindow,
} from './doseInstancePlanner'

// Resolução de tz do dono (write-path + cron) — F4.3f.1
export { resolveUserTz, resolveUserTzMap } from './resolveUserTz'

// Regeneração em massa ao mudar o fuso do perfil ("Me mudei") — F4.3f.2
export { hasFuturePendingDoses, regenActiveProtocolsForTz } from './timezoneRegen'

// Timeline read + adapter dose_instances→eventos (Fase 4 — FP-3 / ADR-050)
export {
  doseInstancesToEvents,
  biomarkersToEvents,
  createTimelineService,
} from './timelineService'

export { createDoseLogService } from './doseLogService'

// Caminho canônico do skip (spec 067 Slice B / ADR-092) — a guarda de janela vive na RPC
export {
  skipDose,
  isOutOfWindowError,
  OUT_OF_WINDOW_MESSAGE_PREFIX,
} from './skipDoseService'

// Núcleo on-demand da base ANVISA (CON-027) — web (Cache Storage) + mobile (AsyncStorage)
export {
  createAnvisaDatabase,
  normalizeText,
  matchesPrefix,
  fetchJson,
  shouldRefreshCache,
  resolveDataUrl,
} from './anvisaDatabase'

// Reativação do controle de estoque (spec 044 — FR-012, gap lazy sem cron)
export {
  STOCK_RESUME_RECONCILE_DAYS,
  LEGACY_UNRECOVERABLE_REASON,
  computeStockPauseGapDays,
  createStockResumeService,
} from './stockResumeService'
export type { StockResumeAssessment, StockResumeService } from './stockResumeService'

// Ativação do controle de estoque pelo saldo inicial (spec 044 — FR-007, sem retro-consumo)
export { INITIAL_BALANCE_REASON, createStockActivationService } from './stockActivationService'
export type {
  InitialBalanceEntry,
  StockActivationResult,
  StockActivationService,
} from './stockActivationService'

// Elegibilidade do upsell de estoque (spec 044 — FR-008, derivado client-side)
export {
  UPSELL_MIN_DOSES,
  UPSELL_MIN_STREAK_DAYS,
  computeDoseStreakDays,
  evaluateStockUpsell,
} from './stockUpsell'
export type { StockUpsellCriteria, StockUpsellEvaluation } from './stockUpsell'

// Coletor do bundle de export LGPD (spec 008 — inventário único web↔mobile)
export { createExportService, FULL_EXPORT_SCOPE } from './exportService'
export type { BuildExportInput, ExportFile, ExportFormat } from './exportService'

// Serviço de auditoria de dose crítica (spec 042 — CON-031, fail-open)
export { createCriticalAuditService } from './criticalAuditService'
export type { CriticalAuditEvent } from './criticalAuditService'

// Trilha de consentimento LGPD (spec 046 — grant/revoke são RPC, nunca INSERT)
export { createConsentService } from './consentService'
export type { ConsentService, ConsentIntent } from './consentService'

// Gate de consentimento (spec 046 Slice B — decisão pura, web e mobile compartilham)
export {
  resolveConsentGate,
  isConsentAllowedRoute,
  isNewConsentSession,
  CONSENT_PROMPT_FREE_SESSIONS,
  CONSENT_SESSION_GAP_MS,
  CONSENT_ALLOWED_WEB_VIEWS,
  CONSENT_ALLOWED_MOBILE_ROUTES,
} from './consentGate'
export type { ConsentGateMode, ConsentGateDecision } from './consentGate'
