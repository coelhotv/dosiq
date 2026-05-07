// src/views/admin/DLQAdmin.jsx
// Dead Letter Queue Admin Interface
import React from 'react'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import { useDLQState } from './useDLQState'
import DLQFilters from './DLQFilters'
import DLQTable from './DLQTable'
import DLQDetailsModal from './DLQDetailsModal'
import './DLQAdmin.css'

/**
 * DLQAdmin - Interface de administração da Dead Letter Queue
 */
export default function DLQAdmin() {
  const {
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
  } = useDLQState()

  return (
    <div className="dlq-admin">
      <header className="dlq-admin__header">
        <h1>Dead Letter Queue</h1>
        <p className="dlq-admin__subtitle">Gerenciamento de notificações falhadas</p>
      </header>

      <DLQFilters
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        total={total}
      />

      {actionMessage && (
        <div className={`dlq-admin__message dlq-admin__message--${actionMessage.type}`}>
          {actionMessage.text}
        </div>
      )}

      {error && (
        <div className="dlq-admin__error">
          <p>Erro ao carregar dados: {error}</p>
          <Button onClick={loadEntries} variant="secondary">
            Tentar novamente
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="dlq-admin__loading">
          <Loading text="Carregando notificações..." />
        </div>
      )}

      {!isLoading && !error && (
        <DLQTable
          entries={entries}
          onViewDetails={handleViewDetails}
          onRetry={handleRetry}
          onDiscard={handleDiscard}
          actionLoading={actionLoading}
          page={page}
          totalPages={totalPages}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      )}

      <DLQDetailsModal
        isOpen={showDetails}
        onClose={closeDetails}
        selectedEntry={selectedEntry}
        handleRetry={handleRetry}
        handleDiscard={handleDiscard}
        actionLoading={actionLoading}
      />

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
