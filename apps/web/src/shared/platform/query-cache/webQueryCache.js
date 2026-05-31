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
    // eslint-disable-next-line no-console
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
  // v2: bump em PR-F4.1 — reescrita das views de adesão (medicine_logs→dose_instances,
  // G6/AP-191). O cache persistido em localStorage sobrevive a hard reload (Cmd+Shift+R
  // só limpa HTTP/memória), então adesão pré-migração ficava "presa". Trocar a chave
  // abandona o cache antigo no deploy → todo cliente refetcha as views novas, sem pedir
  // refresh manual. Bumpar a cada mudança de FONTE/shape de dado cacheado server-side.
  persistKey: 'dosiq_query_cache_v2',
})

// Hidratacao automatica no bootstrap web.
// init() e idempotente — chamadas multiplas sao seguras.
webQueryCache.init().catch((err) => {
  console.warn('[webQueryCache] Falha na inicializacao:', err)
})
