import React from 'react'
import { dlqService } from '@services/api/dlqService'

const USER_ID_TRUNCATE_LENGTH = 8
const ERROR_MESSAGE_TRUNCATE_LENGTH = 50

export default function DLQTable({ 
  entries, 
  onViewDetails, 
  onRetry, 
  onDiscard, 
  actionLoading,
  page,
  totalPages,
  onPrevPage,
  onNextPage
}) {
  return (
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
                        onClick={() => onViewDetails(entry)}
                        title="Ver detalhes"
                      >
                        Ver
                      </button>
                      {(entry.status === 'pending' || entry.status === 'retrying') && (
                        <>
                          <button
                            className="dlq-admin__action-btn dlq-admin__action-btn--retry"
                            onClick={() => onRetry(entry.id)}
                            disabled={actionLoading === entry.id}
                            title="Retentar"
                          >
                            {actionLoading === entry.id ? '...' : 'Retentar'}
                          </button>
                          <button
                            className="dlq-admin__action-btn dlq-admin__action-btn--discard"
                            onClick={() => onDiscard(entry.id)}
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

      {totalPages > 1 && (
        <div className="dlq-admin__pagination">
          <button
            className="dlq-admin__page-btn"
            onClick={onPrevPage}
            disabled={page === 1}
          >
            Anterior
          </button>
          <span className="dlq-admin__page-info">
            Página {page} de {totalPages}
          </span>
          <button
            className="dlq-admin__page-btn"
            onClick={onNextPage}
            disabled={page === totalPages}
          >
            Próxima
          </button>
        </div>
      )}
    </>
  )
}
