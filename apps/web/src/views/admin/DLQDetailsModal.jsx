import React from 'react'
import Modal from '@shared/components/ui/Modal'
import Button from '@shared/components/ui/Button'
import { dlqService } from '@services/api/dlqService'

export default function DLQDetailsModal({ 
  isOpen, 
  onClose, 
  selectedEntry, 
  handleRetry, 
  handleDiscard, 
  actionLoading 
}) {
  if (!selectedEntry) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
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
                  onClose()
                }}
                disabled={actionLoading === selectedEntry.id}
              >
                Retentar
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  handleDiscard(selectedEntry.id)
                  onClose()
                }}
                disabled={actionLoading === selectedEntry.id}
              >
                Descartar
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
