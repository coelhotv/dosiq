// @dosiq/core services — orquestração (geração + persistência) reusável web/mobile/server.
export {
  WINDOW_DAYS,
  RENEWAL_THRESHOLD_DAYS,
  computeWindowEnd,
  planWindow,
  ensureInstancesUpTo,
  renewProtocolWindow,
} from './doseInstancePlanner.js'

// Resolução de tz do dono (write-path + cron) — F4.3f.1
export { resolveUserTz, resolveUserTzMap } from './resolveUserTz.js'

// Regeneração em massa ao mudar o fuso do perfil ("Me mudei") — F4.3f.2
export { hasFuturePendingDoses, regenActiveProtocolsForTz } from './timezoneRegen.js'

// Timeline read + adapter dose_instances→eventos (Fase 4 — FP-3 / ADR-050)
export {
  doseInstancesToEvents,
  createTimelineService,
} from './timelineService.js'
