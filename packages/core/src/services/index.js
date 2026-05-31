// @dosiq/core services — orquestração (geração + persistência) reusável web/mobile/server.
export {
  WINDOW_DAYS,
  RENEWAL_THRESHOLD_DAYS,
  computeWindowEnd,
  planWindow,
  ensureInstancesUpTo,
  renewProtocolWindow,
} from './doseInstancePlanner.js'

// Timeline read + adapter dose_instances→eventos (Fase 4 — FP-3 / ADR-050)
export {
  doseInstancesToEvents,
  createTimelineService,
} from './timelineService.js'
