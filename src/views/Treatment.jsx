import { useState, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'
import { treatmentPlanService } from '@protocols/services/treatmentPlanService'
import { protocolService } from '@shared/services'
import { medicineService } from '@medications/services/medicineService'
import Button from '@shared/components/ui/Button'
import Modal from '@shared/components/ui/Modal'
import TreatmentPlanCard from './treatment/TreatmentPlanCard'
import ProtocolListItem from './treatment/ProtocolListItem'
import MedicineOrphanCard from './treatment/MedicineOrphanCard'
import TreatmentWizard from '@protocols/components/TreatmentWizard'
import './treatment/Treatment.css'

const FREQUENCY_LABELS = {
  diario: 'Diário',
  dias_alternados: 'Dias alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessario: 'Quando necessário',
}

export default function Treatment({ onNavigate }) {
  const [showInactive, setShowInactive] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [medicineToDelete, setMedicineToDelete] = useState(null)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const { medicines, protocols, refresh } = useDashboard()

  const { data: treatmentPlans } = useCachedQuery('treatmentPlans:all', () =>
    treatmentPlanService.getAll()
  )

  // Planos de tratamento com protocolos ativos embarcados
  const plans = useMemo(() => {
    if (!treatmentPlans || treatmentPlans.length === 0) return []

    return treatmentPlans
      .map((plan) => ({
        ...plan,
        activeProtocols: (plan.protocols || []).filter((p) => p.active),
      }))
      .filter((plan) => plan.activeProtocols.length > 0)
  }, [treatmentPlans])

  // Medicamentos avulsos (ativos, sem plano)
  const standaloneProtocols = useMemo(
    () => protocols.filter((p) => p.active && !p.treatment_plan_id),
    [protocols]
  )

  // Medicamentos sem tratamento
  const medicinesWithoutProtocol = useMemo(() => {
    const medsWithProtocol = new Set(protocols.map((p) => p.medicine_id))
    return medicines.filter((m) => !medsWithProtocol.has(m.id))
  }, [medicines, protocols])

  // Tratamentos inativos
  const inactiveProtocols = useMemo(() => protocols.filter((p) => !p.active), [protocols])

  const handleDeleteMedicineClick = useCallback((medicine) => {
    setMedicineToDelete(medicine)
    setDeleteConfirmed(false)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmed) {
      setDeleteConfirmed(true)
      setDeleteError(null)
      return
    }

    try {
      setIsDeleting(true)
      setDeleteError(null)
      await medicineService.delete(medicineToDelete.id)
      setMedicineToDelete(null)
      setDeleteConfirmed(false)
      refresh()
    } catch (err) {
      console.error('Erro ao deletar medicamento:', err)
      setDeleteError(err.message || 'Erro ao deletar medicamento')
    } finally {
      setIsDeleting(false)
    }
  }, [medicineToDelete, deleteConfirmed, refresh])

  const handleCancelDelete = useCallback(() => {
    setMedicineToDelete(null)
    setDeleteConfirmed(false)
    setDeleteError(null)
  }, [])

  const handleEditProtocol = useCallback(
    (protocol) => {
      onNavigate('protocols', { editId: protocol.id })
    },
    [onNavigate]
  )

  const handlePauseProtocol = useCallback(
    async (protocolId) => {
      try {
        await protocolService.update(protocolId, { active: false })
        refresh()
      } catch (err) {
        console.error('Erro ao pausar protocolo:', err)
      }
    },
    [refresh]
  )

  const handleReactivateProtocol = useCallback(
    async (protocolId) => {
      try {
        await protocolService.update(protocolId, { active: true })
        refresh()
      } catch (err) {
        console.error('Erro ao reativar protocolo:', err)
      }
    },
    [refresh]
  )

  const handleCreateProtocol = useCallback(
    (medicine) => {
      onNavigate('protocols', { medicineId: medicine.id })
    },
    [onNavigate]
  )

  const handleWizardComplete = useCallback(() => {
    setIsWizardOpen(false)
    refresh()
  }, [refresh])

  const isEmpty =
    plans.length === 0 && standaloneProtocols.length === 0 && medicinesWithoutProtocol.length === 0

  return (
    <div className="treatment-view">
      <div className="treatment-header">
        <h2 className="treatment-header__title">Meu Tratamento</h2>
        <Button variant="primary" onClick={() => setIsWizardOpen(true)}>
          + Novo
        </Button>
      </div>

      {isEmpty ? (
        <div className="treatment-empty">
          <div className="treatment-empty__icon">💊</div>
          <div className="treatment-empty__title">Nenhum tratamento cadastrado</div>
          <p className="treatment-empty__desc">
            Comece cadastrando seus medicamentos para gerenciar seu tratamento
          </p>
          <Button variant="primary" onClick={() => setIsWizardOpen(true)}>
            Cadastrar primeiro medicamento
          </Button>
        </div>
      ) : (
        <>
          {/* Planos de Tratamento (tratamentos complexos) */}
          {plans.length > 0 && (
            <div className="treatment-section">
              <div className="treatment-section__header">📁 Tratamentos</div>
              {plans.map((plan) => (
                <TreatmentPlanCard key={plan.id} plan={plan}>
                  {plan.activeProtocols.map((protocol) => (
                    <ProtocolListItem
                      key={protocol.id}
                      protocol={protocol}
                      onEdit={handleEditProtocol}
                      onPause={handlePauseProtocol}
                    />
                  ))}
                </TreatmentPlanCard>
              ))}
            </div>
          )}

          {/* Medicamentos Avulsos (tratamentos simples) */}
          {standaloneProtocols.length > 0 && (
            <div className="treatment-section">
              <div className="treatment-section__header">💊 Medicamentos Avulsos</div>
              <div className="treatment-plan-card">
                <div className="treatment-plan-card__body" style={{ paddingTop: 'var(--space-4)' }}>
                  {standaloneProtocols.map((protocol) => (
                    <ProtocolListItem
                      key={protocol.id}
                      protocol={protocol}
                      onEdit={handleEditProtocol}
                      onPause={handlePauseProtocol}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Medicamentos sem Tratamento */}
          {medicinesWithoutProtocol.length > 0 && (
            <div className="treatment-section">
              <div className="treatment-section__header">🔸 Sem Tratamento</div>
              {medicinesWithoutProtocol.map((medicine) => (
                <MedicineOrphanCard
                  key={medicine.id}
                  medicine={medicine}
                  onCreateProtocol={handleCreateProtocol}
                  onDeleteMedicine={handleDeleteMedicineClick}
                />
              ))}
            </div>
          )}

          {/* Inativos */}
          {inactiveProtocols.length > 0 && (
            <div className="treatment-section">
              <button
                className="treatment-inactive-toggle"
                onClick={() => setShowInactive(!showInactive)}
              >
                <span>⏸️ Inativos ({inactiveProtocols.length})</span>
                <span>{showInactive ? '▲' : '▼'}</span>
              </button>
              {showInactive && (
                <div className="treatment-inactive-list">
                  {inactiveProtocols.map((protocol) => (
                    <div key={protocol.id} className="medicine-orphan-card">
                      <div className="medicine-orphan-card__info">
                        <span className="medicine-orphan-card__name">
                          {protocol.medicine?.name || protocol.name || 'Medicamento'}
                        </span>
                        <span className="medicine-orphan-card__detail">
                          {FREQUENCY_LABELS[protocol.frequency] || protocol.frequency} · Inativo
                        </span>
                      </div>
                      <button
                        className="medicine-orphan-card__cta"
                        onClick={() => handleReactivateProtocol(protocol.id)}
                      >
                        Reativar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de confirmação dupla para deletar medicamento */}
      <Modal isOpen={!!medicineToDelete} onClose={handleCancelDelete}>
        <div className="delete-confirmation-modal">
          <h3 className="delete-confirmation-modal__title">
            {!deleteConfirmed
              ? 'Deletar medicamento?'
              : 'Tem certeza? Esta ação não pode ser desfeita.'}
          </h3>
          <p className="delete-confirmation-modal__message">
            {medicineToDelete && (
              <>
                <strong>{medicineToDelete.name}</strong>
                {!deleteConfirmed
                  ? ' será removido do banco de dados.'
                  : ' será deletado permanentemente.'}
              </>
            )}
          </p>
          {deleteError && (
            <p className="delete-confirmation-modal__error">
              ⚠️ {deleteError}
            </p>
          )}
          <div className="delete-confirmation-modal__actions">
            <Button
              variant="secondary"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting
                ? 'Deletando...'
                : deleteConfirmed
                  ? 'Confirmar Deletar'
                  : 'Deletar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Wizard modal */}
      <Modal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)}>
        <TreatmentWizard
          onComplete={handleWizardComplete}
          onCancel={() => setIsWizardOpen(false)}
        />
      </Modal>
    </div>
  )
}
