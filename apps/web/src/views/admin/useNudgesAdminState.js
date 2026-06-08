// apps/web/src/views/admin/useNudgesAdminState.js
// Hook de gerenciamento de estado para NudgesAdmin

import { useState, useEffect, useCallback, startTransition } from 'react'
import nudgeAdminService from '@services/api/nudgeAdminService'

export function useNudgesAdminState() {
  const [nudges, setNudges] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Paginação
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)

  // Filtros
  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [targetViewFilter, setTargetViewFilter] = useState('')

  // Ações
  const [actionMessage, setActionMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const loadNudges = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * pageSize
      const isActive = isActiveFilter === '' ? null : isActiveFilter === 'true'
      const targetView = targetViewFilter === '' ? null : targetViewFilter

      const result = await nudgeAdminService.getAll({
        limit: pageSize,
        offset,
        is_active: isActive,
        target_view: targetView,
      })

      setNudges(result.data || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || 0)
    } catch (err) {
      console.error('[NudgesAdmin] Erro ao carregar nudges:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, isActiveFilter, targetViewFilter])

  useEffect(() => {
    startTransition(() => {
      loadNudges()
    })
  }, [loadNudges])

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  const handleCreate = useCallback(
    async (data) => {
      setActionLoading('create')
      setActionMessage(null)
      try {
        await nudgeAdminService.create(data)

        setActionMessage({
          type: 'success',
          text: 'Nudge criado com sucesso!',
        })

        setPage(1)
        loadNudges()
      } catch (err) {
        setActionMessage({
          type: 'error',
          text: err.message || 'Erro ao criar nudge',
        })
      } finally {
        setActionLoading(null)
      }
    },
    [loadNudges],
  )

  const handleUpdate = useCallback(
    async (id, data) => {
      setActionLoading(id)
      setActionMessage(null)
      try {
        await nudgeAdminService.update(id, data)

        setActionMessage({
          type: 'success',
          text: 'Nudge atualizado com sucesso!',
        })

        loadNudges()
      } catch (err) {
        setActionMessage({
          type: 'error',
          text: err.message || 'Erro ao atualizar nudge',
        })
      } finally {
        setActionLoading(null)
      }
    },
    [loadNudges],
  )

  const handleToggleActive = useCallback(
    async (id, currentStatus) => {
      setActionLoading(id)
      setActionMessage(null)
      try {
        const nextStatus = !currentStatus
        await nudgeAdminService.toggleActive(id, nextStatus)

        setActionMessage({
          type: 'success',
          text: nextStatus ? 'Nudge ativado!' : 'Nudge desativado!',
        })

        loadNudges()
      } catch (err) {
        setActionMessage({
          type: 'error',
          text: err.message || 'Erro ao alternar nudge',
        })
      } finally {
        setActionLoading(null)
      }
    },
    [loadNudges],
  )

  return {
    nudges,
    isLoading,
    error,
    total,
    page,
    totalPages,
    isActiveFilter,
    setIsActiveFilter,
    targetViewFilter,
    setTargetViewFilter,
    actionMessage,
    actionLoading,
    loadNudges,
    handleCreate,
    handleUpdate,
    handleToggleActive,
    setPage,
  }
}
