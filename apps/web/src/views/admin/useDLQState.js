import { useState, useEffect, useCallback } from 'react'
import { dlqService } from '@services/api/dlqService'

function _buildDLQQueryParams(page, pageSize, statusFilter) {
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    status: statusFilter || null,
  }
}

function _buildConfirmAction(type, id, message, serviceCall, successText, setActionLoading, setActionMessage, loadEntries) {
  return {
    type,
    id,
    message,
    onConfirm: async () => {
      setActionLoading(id)
      setActionMessage(null)
      try {
        const result = await serviceCall()
        setActionMessage({ type: 'success', text: result.message || successText })
        loadEntries()
      } catch (err) {
        setActionMessage({ type: 'error', text: err.message })
      } finally {
        setActionLoading(null)
      }
    },
  }
}

/**
 * useDLQState - Hook de gerenciamento de estado para DLQAdmin
 */
export function useDLQState() {
  // Estados principais
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Estados de paginação
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)

  // Estados de filtro
  const [statusFilter, setStatusFilter] = useState('')

  // Estados de ação
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [actionMessage, setActionMessage] = useState(null)

  // Estados de confirmação
  const [confirmAction, setConfirmAction] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const loadEntries = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await dlqService.getAll(_buildDLQQueryParams(page, pageSize, statusFilter))
      setEntries(result.data)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error('[DLQAdmin] Erro ao carregar:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, statusFilter])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleRetry = useCallback((id) => {
    setConfirmAction(_buildConfirmAction('retry', id, 'Deseja retentar esta notificação?',
      () => dlqService.retry(id), 'Notificação reenviada com sucesso!',
      setActionLoading, setActionMessage, loadEntries))
    setShowConfirmModal(true)
  }, [loadEntries])

  const handleDiscard = useCallback((id) => {
    setConfirmAction(_buildConfirmAction('discard', id, 'Deseja descartar esta notificação? Esta ação não pode ser desfeita.',
      () => dlqService.discard(id), 'Notificação descartada.',
      setActionLoading, setActionMessage, loadEntries))
    setShowConfirmModal(true)
  }, [loadEntries])

  const handleConfirmAction = useCallback(async () => {
    if (confirmAction?.onConfirm) await confirmAction.onConfirm()
    setShowConfirmModal(false)
    setConfirmAction(null)
  }, [confirmAction])

  const handleCancelConfirm = useCallback(() => { setShowConfirmModal(false); setConfirmAction(null) }, [])
  const handleViewDetails = useCallback((entry) => { setSelectedEntry(entry); setShowDetails(true) }, [])
  const handlePrevPage = useCallback(() => setPage((prev) => (prev > 1 ? prev - 1 : prev)), [])
  const handleNextPage = useCallback(() => setPage((prev) => (prev < totalPages ? prev + 1 : prev)), [totalPages])
  const handleStatusChange = useCallback((e) => { setStatusFilter(e.target.value); setPage(1) }, [])
  const closeDetails = useCallback(() => setShowDetails(false), [])

  // Limpar mensagem após 5 segundos
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  return {
    entries,
    isLoading,
    error,
    total,
    page,
    totalPages,
    statusFilter,
    selectedEntry,
    showDetails,
    actionLoading,
    actionMessage,
    confirmAction,
    showConfirmModal,
    loadEntries,
    handleRetry,
    handleDiscard,
    handleConfirmAction,
    handleCancelConfirm,
    handleViewDetails,
    handlePrevPage,
    handleNextPage,
    handleStatusChange,
    closeDetails,
  }
}
