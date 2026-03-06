import { useState, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'
import { treatmentPlanService } from '@protocols/services/treatmentPlanService'
import { protocolService } from '@shared/services'
import Button from '@shared/components/ui/Button'
import TreatmentPlanCard from './treatment/TreatmentPlanCard'
import ProtocolListItem from './treatment/ProtocolListItem'
import MedicineOrphanCard from './treatment/MedicineOrphanCard'
import './treatment/Treatment.css'

export default function Treatment({ onNavigate }) {
  const [showInactive, setShowInactive] = useState(false)

  const { medicines, protocols, refresh } = useDashboard()

  const { data: treatmentPlans } = useCachedQuery({
    key: 'treatmentPlans:all',
    fetcher: () => treatmentPlanService.getAll(),
  })

  // Planos com protocolos ativos
  const plans = useMemo(() =>
    (treatmentPlans || [])
      .map(plan => ({
        ...plan,
        activeProtocols: (plan.protocols || []).filter(p => p.active),
      }))
      .filter(plan => plan.activeProtocols.length > 0),
    [treatmentPlans]
  )

  // Protocolos avulsos (ativos, sem plano)
  const standaloneProtocols = useMemo(() =>
    protocols.filter(p => p.active && !p.treatment_plan_id),
    [protocols]
  )

  // Medicamentos sem protocolo
  const medicinesWithoutProtocol = useMemo(() => {
    const medsWithProtocol = new Set(protocols.map(p => p.medicine_id))
    return medicines.filter(m => !medsWithProtocol.has(m.id))
  }, [medicines, protocols])

  // Protocolos inativos
  const inactiveProtocols = useMemo(() =>
    protocols.filter(p => !p.active),
    [protocols]
  )

  const handleEditProtocol = useCallback((protocol) => {
    onNavigate('protocols', { editId: protocol.id })
  }, [onNavigate])

  const handlePauseProtocol = useCallback(async (protocolId) => {
    try {
      await protocolService.update(protocolId, { active: false })
      refresh()
    } catch (err) {
      console.error('Erro ao pausar protocolo:', err)
    }
  }, [refresh])

  const handleReactivateProtocol = useCallback(async (protocolId) => {
    try {
      await protocolService.update(protocolId, { active: true })
      refresh()
    } catch (err) {
      console.error('Erro ao reativar protocolo:', err)
    }
  }, [refresh])

  const handleCreateProtocol = useCallback((medicine) => {
    onNavigate('protocols', { medicineId: medicine.id })
  }, [onNavigate])

  const handleNewTreatment = useCallback(() => {
    onNavigate('medicines')
  }, [onNavigate])

  const isEmpty = plans.length === 0
    && standaloneProtocols.length === 0
    && medicinesWithoutProtocol.length === 0

  return (
    <div className="treatment-view">
      <div className="treatment-header">
        <h2 className="treatment-header__title">Meu Tratamento</h2>
        <Button variant="primary" onClick={handleNewTreatment}>
          + Novo
        </Button>
      </div>

      {isEmpty ? (
        <div className="treatment-empty">
          <div className="treatment-empty__icon">💊</div>
          <div className="treatment-empty__title">Nenhum tratamento cadastrado</div>
          <p className="treatment-empty__desc">
            Comece cadastrando seus medicamentos e protocolos para gerenciar seu tratamento
          </p>
          <Button variant="primary" onClick={handleNewTreatment}>
            Cadastrar primeiro medicamento
          </Button>
        </div>
      ) : (
        <>
          {/* Planos de Tratamento */}
          {plans.length > 0 && (
            <div className="treatment-section">
              <div className="treatment-section__header">
                📁 Planos de Tratamento
              </div>
              {plans.map(plan => (
                <TreatmentPlanCard key={plan.id} plan={plan}>
                  {plan.activeProtocols.map(protocol => (
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

          {/* Protocolos Avulsos */}
          {standaloneProtocols.length > 0 && (
            <div className="treatment-section">
              <div className="treatment-section__header">
                📋 Protocolos Avulsos
              </div>
              <div className="treatment-plan-card">
                <div className="treatment-plan-card__body" style={{ paddingTop: 'var(--space-4)' }}>
                  {standaloneProtocols.map(protocol => (
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

          {/* Medicamentos sem Protocolo */}
          {medicinesWithoutProtocol.length > 0 && (
            <div className="treatment-section">
              <div className="treatment-section__header">
                💊 Sem Protocolo
              </div>
              {medicinesWithoutProtocol.map(medicine => (
                <MedicineOrphanCard
                  key={medicine.id}
                  medicine={medicine}
                  onCreateProtocol={handleCreateProtocol}
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
                  {inactiveProtocols.map(protocol => (
                    <div key={protocol.id} className="medicine-orphan-card">
                      <div className="medicine-orphan-card__info">
                        <span className="medicine-orphan-card__name">
                          {protocol.medicine?.name || protocol.name || 'Protocolo'}
                        </span>
                        <span className="medicine-orphan-card__detail">
                          Inativo
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
    </div>
  )
}
