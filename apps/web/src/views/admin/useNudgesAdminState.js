// apps/web/src/views/admin/useNudgesAdminState.js
// Hook de gerenciamento de estado para NudgesAdmin

import { useState, useEffect, useCallback, startTransition } from 'react'
import nudgeAdminService from '@services/api/nudgeAdminService'

async function _runAction({ id, run, successText, setActionLoading, setActionMessage, onCompleted }) {
  setActionLoading(id)
  setActionMessage(null)
  try {
    await run()
    setActionMessage({
      type: 'success',
      text: successText,
    })
    onCompleted()
  } catch (err) {
    setActionMessage({
      type: 'error',
      text: err.message || 'Erro ao realizar ação',
    })
  } finally {
    setActionLoading(null)
  }
}

function useNudgeFilters() {
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)

  const [isActiveFilter, setIsActiveFilter] = useState('')
  const [targetViewFilter, setTargetViewFilter] = useState('')

  return {
    total,
    setTotal,
    page,
    setPage,
    pageSize,
    totalPages,
    setTotalPages,
    isActiveFilter,
    setIsActiveFilter,
    targetViewFilter,
    setTargetViewFilter,
  }
}

function useNudgeActions(loadNudges, setPage) {
  const [actionMessage, setActionMessage] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  const handleCreate = useCallback(
    async (data) => {
      await _runAction({
        id: 'create',
        run: () => nudgeAdminService.create(data),
        successText: 'Nudge criado com sucesso!',
        setActionLoading,
        setActionMessage,
        onCompleted: () => {
          setPage(1)
          loadNudges()
        },
      })
    },
    [loadNudges, setPage],
  )

  const handleUpdate = useCallback(
    async (id, data) => {
      await _runAction({
        id,
        run: () => nudgeAdminService.update(id, data),
        successText: 'Nudge atualizado com sucesso!',
        setActionLoading,
        setActionMessage,
        onCompleted: loadNudges,
      })
    },
    [loadNudges],
  )

  const handleToggleActive = useCallback(
    async (id, currentStatus) => {
      const nextStatus = !currentStatus
      await _runAction({
        id,
        run: () => nudgeAdminService.toggleActive(id, nextStatus),
        successText: nextStatus ? 'Nudge ativado!' : 'Nudge desativado!',
        setActionLoading,
        setActionMessage,
        onCompleted: loadNudges,
      })
    },
    [loadNudges],
  )

  return {
    actionMessage,
    actionLoading,
    handleCreate,
    handleUpdate,
    handleToggleActive,
  }
}

export function useNudgesAdminState() {
  const [nudges, setNudges] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const filters = useNudgeFilters()
  const { page, pageSize, isActiveFilter, targetViewFilter, setTotal, setTotalPages, setPage } = filters

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
  }, [page, pageSize, isActiveFilter, targetViewFilter, setTotal, setTotalPages])

  // Exceção R-010: loadNudges (useCallback) declarado antes para evitar TDZ no useEffect
  useEffect(() => {
    startTransition(() => {
      loadNudges()
    })
  }, [loadNudges])

  const actions = useNudgeActions(loadNudges, setPage)

  return {
    nudges,
    isLoading,
    error,
    loadNudges,
    ...filters,
    ...actions,
  }
}

