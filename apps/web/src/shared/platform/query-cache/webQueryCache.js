/**
 * webQueryCache — Instancia do query cache para a plataforma web
 *
 * Criado via factory do shared-data com:
 * - webStorageAdapter: persistencia via localStorage (via contrato H3.1)
 * - logger: console do browser
 * - configuracoes padrao do projeto
 *
 * IMPORTANTE: init() e chamado aqui para hidratar o cache no bootstrap da web.
 * Em outras plataformas (mobile), o bootstrap chama init() explicitamente.
 *
 * Estrategia de coexistencia (H3.3):
 * - Este modulo cria a nova instancia de cache
 * - useCachedQuery.js importa daqui (nao mais de queryCache.js legado)
 * - queryCache.js legado removido apos validacao bem-sucedida
 */
import { createQueryCache } from '@dosiq/shared-data'
import { webStorageAdapter } from '@shared/platform/storage/webStorageAdapter'

const logger = {
  log: (msg) => {
    if (import.meta.env.DEV) console.debug(msg)
  },
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
}

export const webQueryCache = createQueryCache({
  storage: webStorageAdapter,
  logger,
  staleTime: 30_000,
  maxEntries: 200,
  persistKey: 'dosiq_query_cache',
})

// Hidratacao automatica no bootstrap web.
// init() e idempotente — chamadas multiplas sao seguras.
webQueryCache.init().catch((err) => {
  console.warn('[webQueryCache] Falha na inicializacao:', err)
})
