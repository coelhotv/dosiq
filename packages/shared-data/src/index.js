/**
 * @meus-remedios/shared-data — Camada de dados compartilhada (platform-agnostic)
 *
 * Exporta:
 * - Query cache engine (createQueryCache, CACHE_KEYS, generateCacheKey)
 * - Supabase factories (createSupabaseDependencies, createSupabaseClient)
 * - Service factories (createUserSessionRepository)
 *
 * REGRAS DE OURO (Fase 3):
 * - Nenhum singleton global
 * - Nenhum import de React, window, localStorage, import.meta.env
 * - Tudo criado por factory com dependencias injetadas
 */

// Query Cache
export { createQueryCache } from './query-cache/createQueryCache.js'
export { CACHE_KEYS, generateCacheKey } from './query-cache/cacheKeys.js'

// Supabase factories
export { createSupabaseDependencies } from './supabase/createSupabaseDependencies.js'
export { createSupabaseClient } from './supabase/createSupabaseClient.js'

// Service factories
export { createUserSessionRepository } from './services/createUserSessionRepository.js'
