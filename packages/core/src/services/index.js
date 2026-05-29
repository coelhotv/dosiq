// @dosiq/core services — orquestração (geração + persistência) reusável web/mobile/server.
export {
  WINDOW_DAYS,
  RENEWAL_THRESHOLD_DAYS,
  computeWindowEnd,
  planWindow,
  ensureInstancesUpTo,
  renewProtocolWindow,
} from './doseInstancePlanner.js'
