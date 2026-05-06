/**
 * createQueryCache — Engine de cache SWR compartilhada (platform-agnostic)
 *
 * Design:
 * - Factory function: sem singleton global, sem inicializacao em import
 * - Storage injetado: funciona com web localStorage, AsyncStorage, memoryStorage
 * - Logger injetado: sem dependencia de console/debugLog especifico da plataforma
 * - React-free: a engine nao importa React — hooks ficam na plataforma
 * - Async-first: persiste/hidrata via storage adapter async (contratos H3.1)
 *
 * Regra: NUNCA chamar `init()` fora do bootstrap da plataforma.
 *
 * @module createQueryCache
 */

import { setJSON, getJSON } from '@dosiq/storage'
import { _buildCache } from './_cacheBuilder'

/**
 * Cria uma instancia de query cache com dependencias injetadas.
 *
 * @param {Object} options
 * @param {import('@dosiq/storage').StorageAdapter} options.storage - Adapter de storage async
 * @param {Object} [options.logger] - Logger opcional com metodo log/warn/error
 * @param {number} [options.staleTime=30000] - Tempo (ms) antes de um entry ficar stale
 * @param {number} [options.maxEntries=200] - Maximo de entradas no cache (LRU eviction)
 * @param {string} [options.persistKey='dosiq_query_cache'] - Chave de persistencia
 * @returns {QueryCache} Instancia do cache
 */
export function createQueryCache({
  storage,
  logger = null,
  staleTime = 30_000,
  maxEntries = 200,
  persistKey = 'dosiq_query_cache',
} = {}) {
  if (!storage) throw new Error('createQueryCache: storage adapter is required')
  return _buildCache({ storage, logger, staleTime, maxEntries, persistKey, setJSON, getJSON })
}
