// src/views/admin/DLQAdmin.jsx
// Dead Letter Queue Admin Interface
import { useState, useEffect, useCallback } from 'react'
import { dlqService } from '@services/api/dlqService'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import './DLQAdmin.css'

// Constantes de formatação
const USER_ID_TRUNCATE_LENGTH = 8
const ERROR_MESSAGE_TRUNCATE_LENGTH = 50

/**
 * DLQAdmin - Interface de administração da Dead Letter Queue
 *
 * Funcionalidades:
 * - Lista notificações falhadas com paginação
 * - Filtra por status
 * - Permite retentar ou descartar notificações
 * - Exibe detalhes de cada notificação
 */
export default function DLQAdmin() {
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

  // Carregar dados
  const loadEntries = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const offset = (page - 1) * pageSize
      const result = await dlqService.getAll({
        limit: pageSize,
        offset,
        status: statusFilter || null,
      })

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

  // Handlers de ação com Modal de confirmação
  const handleRetry = async (id) => {
    setConfirmAction({
      type: 'retry',
      id,
      message: 'Deseja retentar esta notificação?',
      onConfirm: async () => {
        setActionLoading(id)
        setActionMessage(null)

        try {
          const result = await dlqService.retry(id)
          setActionMessage({
            type: 'success',
            text: result.message || 'Notificação reenviada com sucesso!',
          })
          loadEntries() // Recarregar lista
        } catch (err) {
          setActionMessage({ type: 'error', text: err.message })
        } finally {
          setActionLoading(null)
        }
      },
    })
    setShowConfirmModal(true)
  }

  const handleDiscard = async (id) => {
    setConfirmAction({
      type: 'discard',
      id,
      message: 'Deseja descartar esta notificação? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setActionLoading(id)
        setActionMessage(null)

        try {
          const result = await dlqService.discard(id)
          setActionMessage({ type: 'success', text: result.message || 'Notificação descartada.' })
          loadEntries() // Recarregar lista
        } catch (err) {
          setActionMessage({ type: 'error', text: err.message })
        } finally {
          setActionLoading(null)
        }
      },
    })
    setShowConfirmModal(true)
  }

  // Handler de confirmação
  const handleConfirmAction = async () => {
    if (confirmAction?.onConfirm) {
      await confirmAction.onConfirm()
    }
    setShowConfirmModal(false)
    setConfirmAction(null)
  }

  const handleCancelConfirm = () => {
    setShowConfirmModal(false)
    setConfirmAction(null)
  }

  const handleViewDetails = (entry) => {
    setSelectedEntry(entry)
    setShowDetails(true)
  }

  // Handlers de paginação
  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1)
  }

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1)
  }

  // Handler de filtro
  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value)
    setPage(1) // Resetar para primeira página
  }

  // Limpar mensagem após 5 segundos
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [actionMessage])

  return (
    <div className="dlq-admin">
      <header className="dlq-admin__header">
        <h1>Dead Letter Queue</h1>
        <p className="dlq-admin__subtitle">Gerenciamento de notificações falhadas</p>
      </header>

      {/* Filtros e estatísticas */}
      <div className="dlq-admin__controls">
        <div className="dlq-admin__filter">
          <label htmlFor="status-filter">Filtrar por status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusChange}
            className="dlq-admin__select"
          >
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="retrying">Retentando</option>
            <option value="resolved">Resolvido</option>
            <option value="discarded">Descartado</option>
          </select>
        </div>

        <div className="dlq-admin__stats">
          <span className="dlq-admin__stat">
            <strong>{total}</strong> notificações
          </span>
        </div>
      </div>

      {/* Mensagem de ação */}
      {actionMessage && (
        <div className={`dlq-admin__message dlq-admin__message--${actionMessage.type}`}>
          {actionMessage.text}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="dlq-admin__error">
          <p>Erro ao carregar dados: {error}</p>
          <Button onClick={loadEntries} variant="secondary">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="dlq-admin__loading">
          <Loading text="Carregando notificações..." />
        </div>
      )}

      {/* Tabela */}
      {!isLoading && !error && (
        <>
          <div className="dlq-admin__table-container">
            <table className="dlq-admin__table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Erro</th>
                  <th>Tentativas</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="dlq-admin__empty">
                      Nenhuma notificação encontrada
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="dlq-admin__row">
                      <td className="dlq-admin__cell dlq-admin__cell--date">
                        {dlqService.formatDate(entry.created_at)}
                      </td>
                      <td className="dlq-admin__cell dlq-admin__cell--user">
                        <span className="dlq-admin__user-id">
                          {entry.user_id
                            ? entry.user_id.substring(0, USER_ID_TRUNCATE_LENGTH) + '...'
                            : '-'}
                        </span>
                      </td>
                      <td className="dlq-admin__cell">
                        {dlqService.formatNotificationType(entry.notification_type)}
                      </td>
                      <td className="dlq-admin__cell">
                        <span
                          className="dlq-admin__status"
                          style={{ color: dlqService.getStatusColor(entry.status) }}
                        >
                          {dlqService.formatStatus(entry.status)}
                        </span>
                      </td>
                      <td className="dlq-admin__cell dlq-admin__cell--error">
                        <span className="dlq-admin__error-text" title={entry.error_message}>
                          {entry.error_message
                            ? entry.error_message.length > ERROR_MESSAGE_TRUNCATE_LENGTH
                              ? entry.error_message.substring(0, ERROR_MESSAGE_TRUNCATE_LENGTH) +
                                '...'
                              : entry.error_message
                            : '-'}
                        </span>
                      </td>
                      <td className="dlq-admin__cell dlq-admin__cell--attempts">
                        {entry.retry_count || 0}
                      </td>
                      <td className="dlq-admin__cell dlq-admin__cell--actions">
                        <div className="dlq-admin__actions">
                          <button
                            className="dlq-admin__action-btn dlq-admin__action-btn--view"
                            onClick={() => handleViewDetails(entry)}
                            title="Ver detalhes"
                          >
                            Ver
                          </button>
                          {(entry.status === 'pending' || entry.status === 'retrying') && (
                            <>
                              <button
                                className="dlq-admin__action-btn dlq-admin__action-btn--retry"
                                onClick={() => handleRetry(entry.id)}
                                disabled={actionLoading === entry.id}
                                title="Retentar"
                              >
                                {actionLoading === entry.id ? '...' : 'Retentar'}
                              </button>
                              <button
                                className="dlq-admin__action-btn dlq-admin__action-btn--discard"
                                onClick={() => handleDiscard(entry.id)}
                                disabled={actionLoading === entry.id}
                                title="Descartar"
                              >
                                Descartar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="dlq-admin__pagination">
              <button
                className="dlq-admin__page-btn"
                onClick={handlePrevPage}
                disabled={page === 1}
              >
                Anterior
              </button>
              <span className="dlq-admin__page-info">
                Página {page} de {totalPages}
              </span>
              <button
                className="dlq-admin__page-btn"
                onClick={handleNextPage}
                disabled={page === totalPages}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes */}
      {showDetails && selectedEntry && (
        <Modal isOpen={showDetails} onClose={() => setShowDetails(false)}>
          <div className="dlq-admin__details">
            <h2>Detalhes da Notificação</h2>

            <div className="dlq-admin__detail-grid">
              <div className="dlq-admin__detail-item">
                <label>ID:</label>
                <span className="dlq-admin__detail-value dlq-admin__detail-value--mono">
                  {selectedEntry.id}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Correlation ID:</label>
                <span className="dlq-admin__detail-value dlq-admin__detail-value--mono">
                  {selectedEntry.correlation_id || '-'}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>User ID:</label>
                <span className="dlq-admin__detail-value dlq-admin__detail-value--mono">
                  {selectedEntry.user_id || '-'}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Protocol ID:</label>
                <span className="dlq-admin__detail-value dlq-admin__detail-value--mono">
                  {selectedEntry.protocol_id || '-'}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Tipo:</label>
                <span className="dlq-admin__detail-value">
                  {dlqService.formatNotificationType(selectedEntry.notification_type)}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Status:</label>
                <span
                  className="dlq-admin__detail-value"
                  style={{ color: dlqService.getStatusColor(selectedEntry.status) }}
                >
                  {dlqService.formatStatus(selectedEntry.status)}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Categoria de Erro:</label>
                <span className="dlq-admin__detail-value">
                  {dlqService.formatErrorCategory(selectedEntry.error_category)}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Código de Erro:</label>
                <span className="dlq-admin__detail-value">{selectedEntry.error_code || '-'}</span>
              </div>

              <div className="dlq-admin__detail-item dlq-admin__detail-item--full">
                <label>Mensagem de Erro:</label>
                <span className="dlq-admin__detail-value dlq-admin__detail-value--error">
                  {selectedEntry.error_message || '-'}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Tentativas:</label>
                <span className="dlq-admin__detail-value">{selectedEntry.retry_count || 0}</span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Criado em:</label>
                <span className="dlq-admin__detail-value">
                  {dlqService.formatDate(selectedEntry.created_at)}
                </span>
              </div>

              <div className="dlq-admin__detail-item">
                <label>Atualizado em:</label>
                <span className="dlq-admin__detail-value">
                  {dlqService.formatDate(selectedEntry.updated_at)}
                </span>
              </div>

              {selectedEntry.resolved_at && (
                <div className="dlq-admin__detail-item">
                  <label>Resolvido em:</label>
                  <span className="dlq-admin__detail-value">
                    {dlqService.formatDate(selectedEntry.resolved_at)}
                  </span>
                </div>
              )}

              {selectedEntry.resolution_notes && (
                <div className="dlq-admin__detail-item dlq-admin__detail-item--full">
                  <label>Notas de Resolução:</label>
                  <span className="dlq-admin__detail-value">{selectedEntry.resolution_notes}</span>
                </div>
              )}

              {selectedEntry.notification_payload && (
                <div className="dlq-admin__detail-item dlq-admin__detail-item--full">
                  <label>Payload:</label>
                  <pre className="dlq-admin__detail-value dlq-admin__detail-value--code">
                    {JSON.stringify(selectedEntry.notification_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="dlq-admin__detail-actions">
              {(selectedEntry.status === 'pending' || selectedEntry.status === 'retrying') && (
                <>
                  <Button
                    onClick={() => {
                      handleRetry(selectedEntry.id)
                      setShowDetails(false)
                    }}
                    disabled={actionLoading === selectedEntry.id}
                  >
                    Retentar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      handleDiscard(selectedEntry.id)
                      setShowDetails(false)
                    }}
                    disabled={actionLoading === selectedEntry.id}
                  >
                    Descartar
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setShowDetails(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de confirmação */}
      {showConfirmModal && confirmAction && (
        <Modal isOpen={showConfirmModal} onClose={handleCancelConfirm}>
          <div className="dlq-admin__confirm">
            <h2>Confirmar Ação</h2>
            <p>{confirmAction.message}</p>
            <div className="dlq-admin__confirm-actions">
              <Button onClick={handleConfirmAction} disabled={actionLoading === confirmAction.id}>
                Confirmar
              </Button>
              <Button variant="secondary" onClick={handleCancelConfirm}>
                Cancelar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
