/**
 * useNotificationLog — Hook React para histórico de notificações (Web/PWA)
 *
 * Utiliza SWR via useCachedQuery para gerenciamento de cache e revalidação.
 *
 * @module useNotificationLog
 */

import { useMemo, useCallback } from 'react'
import { useCachedQuery, generateCacheKey } from '@shared/hooks/useCachedQuery'
import { createNotificationLogRepository, CACHE_KEYS } from '@dosiq/shared-data'
import { supabase } from '@shared/utils/supabase'

// Repositório singleton para a plataforma web
const repo = createNotificationLogRepository({ supabase })

/**
 * Hook para buscar logs de notificações com cache SWR.
 *
 * @param {Object} options
 * @param {string} options.userId - ID do usuário (UUID)
 * @param {number} [options.limit=20] - Itens por página
 * @param {number} [options.offset=0] - Offset de paginação
 * @param {boolean} [options.enabled=true] - Se a query deve rodar
 * @returns {Object} { data, isLoading, isFetching, error, refetch, refresh }
 */
export function useNotificationLog(options = {}) {
  const { userId, limit = 20, offset = 0, enabled = true } = options

  // Chave de cache canônica e estável
  const cacheKey = useMemo(() => {
    if (!userId) return null
    return generateCacheKey(CACHE_KEYS.NOTIFICATIONS_PAGINATED, { userId, limit, offset })
  }, [userId, limit, offset])

  // Fetcher que utiliza o repositório compartilhado
  // High Priority: Memorizado para evitar loops de re-renderização
  const fetcher = useCallback(async () => {
    if (!userId) return []
    return repo.listByUserId(userId, { limit, offset })
  }, [userId, limit, offset])

  return useCachedQuery(cacheKey, fetcher, {
    enabled: enabled && !!userId,
    staleTime: 60 * 1000, // 1 minuto (Notificações têm volatilidade média)
  })
}
