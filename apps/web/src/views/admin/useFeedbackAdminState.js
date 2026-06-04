// apps/web/src/views/admin/useFeedbackAdminState.js
// Hook de gerenciamento de estado para FeedbackAdmin

import { useState, useEffect, useCallback, startTransition } from 'react'
import feedbackAdminService from '@services/api/feedbackAdminService'

export function useFeedbackAdminState() {
  const [feedbacks, setFeedbacks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Paginação
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10) // 10 por página é ideal para visualização em formato card
  const [totalPages, setTotalPages] = useState(0)

  // Filtros
  const [isResolvedFilter, setIsResolvedFilter] = useState('') // '', 'true', 'false'
  const [ratingFilter, setRatingFilter] = useState('') // '', '1'..'5'

  // Estatísticas
  const [stats, setStats] = useState({
    avgRating: 0,
    pendingCount: 0,
    totalCount: 0
  })

  // Ações de alteração de status
  const [actionMessage, setActionMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const loadFeedbacks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const isResolved = isResolvedFilter === '' ? null : isResolvedFilter === 'true'
      const rating = ratingFilter === '' ? null : parseInt(ratingFilter)

      const result = await feedbackAdminService.getAll({
        limit: pageSize,
        offset,
        is_resolved: isResolved,
        rating
      })

      setFeedbacks(result.data || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || 0)

      if (result.stats) {
        setStats(result.stats)
      } else if (page === 1 && isResolvedFilter === '' && ratingFilter === '') {
        const data = result.data || []
        const totalCount = result.total || 0
        const pendingCount = data.filter(f => !f.is_resolved).length
        const sum = data.reduce((acc, curr) => acc + (curr.rating || 0), 0)
        setStats({
          avgRating: totalCount > 0 ? parseFloat((sum / Math.min(data.length, totalCount)).toFixed(1)) : 0,
          pendingCount,
          totalCount
        })
      }
    } catch (err) {
      console.error('[FeedbackAdmin] Erro ao carregar feedbacks:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, isResolvedFilter, ratingFilter])

  useEffect(() => {
    startTransition(() => {
      loadFeedbacks()
    })
  }, [loadFeedbacks])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  const handleResolveToggle = useCallback(async (id, currentStatus) => {
    setActionLoading(id)
    setActionMessage(null)
    try {
      const nextStatus = !currentStatus
      await feedbackAdminService.resolve(id, nextStatus)

      setActionMessage({
        type: 'success',
        text: nextStatus ? 'Feedback marcado como resolvido!' : 'Feedback reaberto com sucesso.'
      })

      loadFeedbacks()
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Erro ao atualizar feedback'
      })
    } finally {
      setActionLoading(null)
    }
  }, [loadFeedbacks])

  return {
    feedbacks,
    isLoading,
    error,
    total,
    page,
    totalPages,
    isResolvedFilter,
    setIsResolvedFilter,
    ratingFilter,
    setRatingFilter,
    stats,
    actionMessage,
    actionLoading,
    loadFeedbacks,
    handleResolveToggle,
    setPage
  }
}
