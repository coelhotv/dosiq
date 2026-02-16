import { useState, useEffect, useCallback } from 'react'
import { medicineService, protocolService, treatmentPlanService } from '@shared/services'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import ProtocolForm from '@protocols/components/ProtocolForm'
import ProtocolCard from '@protocols/components/ProtocolCard'
import TreatmentPlanForm from '@protocols/components/TreatmentPlanForm'
import Card from '@shared/components/ui/Card'
import { calculateTitrationData } from '@protocols/utils/titrationUtils'
import './Protocols.css'

export default function Protocols({ initialParams, onClearParams, onNavigateToStock }) {
  const [medicines, setMedicines] = useState([])
  const [protocols, setProtocols] = useState([])
  const [treatmentPlans, setTreatmentPlans] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [editingProtocol, setEditingProtocol] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [medicinesData, protocolsData, plansData] = await Promise.all([
        medicineService.getAll(),
        protocolService.getAll(),
        treatmentPlanService.getAll(),
      ])

      // Enrich protocols with titration data
      const enrichedProtocols = protocolsData.map((p) => ({
        ...p,
        titration_scheduler_data: calculateTitrationData(p),
      }))

      setMedicines(medicinesData)
      setProtocols(enrichedProtocols)
      setTreatmentPlans(plansData)
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      setIsModalOpen(true)
      setEditingProtocol(null)
    }
  }, [initialParams, medicines])

  const handleAdd = () => {
    if (medicines.length === 0) {
      setError('Cadastre um medicamento antes de criar protocolos')
      return
    }
    setEditingProtocol(null)
    setIsModalOpen(true)
  }

  const handleAddPlan = () => {
    setEditingPlan(null)
    setIsPlanModalOpen(true)
  }

  const handleEdit = (protocol) => {
    setEditingProtocol(protocol)
    setIsModalOpen(true)
  }

  const handleEditPlan = (plan) => {
    setEditingPlan(plan)
    setIsPlanModalOpen(true)
  }

  const handleSave = async (protocolData) => {
    try {
      if (editingProtocol) {
        await protocolService.update(editingProtocol.id, protocolData)
        showSuccess('Protocolo atualizado com sucesso!')
      } else {
        await protocolService.create(protocolData)
        showSuccess('Protocolo criado com sucesso!')

        if (
          window.confirm(
            'Protocolo criado! Deseja adicionar o estoque inicial deste medicamento agora?'
          )
        ) {
          onNavigateToStock(protocolData.medicine_id)
        }
      }

      setIsModalOpen(false)
      setEditingProtocol(null)
      if (onClearParams) onClearParams()
      await loadData()
    } catch (err) {
      throw new Error('Erro ao salvar protocolo: ' + err.message)
    }
  }

  const handleSavePlan = async (planData) => {
    try {
      if (editingPlan) {
        await treatmentPlanService.update(editingPlan.id, planData)
        showSuccess('Plano de tratamento atualizado!')
      } else {
        await treatmentPlanService.create(planData)
        showSuccess('Plano de tratamento criado!')
      }

      setIsPlanModalOpen(false)
      setEditingPlan(null)
      await loadData()
    } catch (err) {
      throw new Error('Erro ao salvar plano: ' + err.message)
    }
  }

  const handleToggleActive = async (protocol) => {
    try {
      await protocolService.update(protocol.id, { active: !protocol.active })
      showSuccess(`Protocolo ${!protocol.active ? 'ativado' : 'pausado'} com sucesso!`)
      await loadData()
    } catch (err) {
      setError('Erro ao atualizar protocolo: ' + err.message)
      console.error(err)
    }
  }

  const handleDelete = async (protocol) => {
    if (!window.confirm(`Tem certeza que deseja excluir o protocolo "${protocol.name}"?`)) {
      return
    }

    try {
      await protocolService.delete(protocol.id)
      showSuccess('Protocolo excluído com sucesso!')
      await loadData()
    } catch (err) {
      setError('Erro ao excluir protocolo: ' + err.message)
      console.error(err)
    }
  }

  const handleDeletePlan = async (plan) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir o plano "${plan.name}" e desvincular seus remédios?`
      )
    ) {
      return
    }

    try {
      await treatmentPlanService.delete(plan.id)
      showSuccess('Plano excluído com sucesso!')
      await loadData()
    } catch (err) {
      setError('Erro ao excluir plano: ' + err.message)
      console.error(err)
    }
  }

  const showSuccess = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  // Separar protocolos ativos e inativos
  const activeProtocols = protocols.filter((p) => p.active)
  const inactiveProtocols = protocols.filter((p) => !p.active)

  if (isLoading) {
    return (
      <div className="protocols-view">
        <Loading text="Carregando protocolos..." />
      </div>
    )
  }

  return (
    <div className="protocols-view">
      <div className="protocols-header">
        <div>
          <h2>📋 Protocolos</h2>
          <p className="protocols-subtitle">
            Gerencie seus protocolos e planos de tratamento agrupados
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" onClick={handleAddPlan}>
            📁 Novo Plano (Grupo)
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            ➕ Criar Protocolo
          </Button>
        </div>
      </div>

      {successMessage && <div className="success-banner fade-in">✅ {successMessage}</div>}

      {error && <div className="error-banner fade-in">❌ {error}</div>}

      {medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>Nenhum medicamento cadastrado</h3>
          <p>Cadastre medicamentos primeiro para criar protocolos</p>
        </div>
      ) : (
        <div className="protocols-content">
          {/* Planos de Tratamentos */}
          {treatmentPlans.length > 0 && (
            <div className="treatment-plans-section">
              <h3 className="section-title plans">📁 Planos de Tratamento</h3>
              <div className="plans-grid">
                {treatmentPlans.map((plan) => (
                  <Card key={plan.id} className="treatment-plan-card">
                    <div className="plan-header">
                      <div>
                        <h4>{plan.name}</h4>
                        <p className="plan-objective">{plan.objective}</p>
                      </div>
                      <div className="plan-actions">
                        <Button variant="ghost" size="sm" onClick={() => handleEditPlan(plan)}>
                          ✏️
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePlan(plan)}>
                          🗑️
                        </Button>
                      </div>
                    </div>
                    {plan.description && <p className="plan-desc">{plan.description}</p>}

                    <div className="plan-protocols-list">
                      {plan.protocols && plan.protocols.length > 0 ? (
                        plan.protocols.map((p) => (
                          <div key={p.id} className="plan-protocol-row">
                            <span>💊 {p.name}</span>
                            <span className={`titration-status-mini ${p.titration_status}`}>
                              {p.titration_status === 'titulando' ? '📈 Titulando' : '✅'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="empty-plan">Nenhum remédio vinculado ainda.</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Protocolos ativos */}
          {activeProtocols.length > 0 && (
            <div className="protocols-section">
              <h3 className="section-title active">
                {treatmentPlans.length > 0
                  ? '🔍 Todos os Protocolos Ativos'
                  : '✅ Protocolos Ativos'}{' '}
                ({activeProtocols.length})
              </h3>
              <div className="protocols-grid">
                {activeProtocols.map((protocol) => (
                  <ProtocolCard
                    key={protocol.id}
                    protocol={protocol}
                    onEdit={handleEdit}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Protocolos inativos */}
          {inactiveProtocols.length > 0 && (
            <div className="protocols-section">
              <h3 className="section-title inactive">
                ⏸️ Protocolos Pausados ({inactiveProtocols.length})
              </h3>
              <div className="protocols-grid">
                {inactiveProtocols.map((protocol) => (
                  <ProtocolCard
                    key={protocol.id}
                    protocol={protocol}
                    onEdit={handleEdit}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal para Protocolos */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingProtocol(null)
          if (onClearParams) onClearParams()
        }}
      >
        <ProtocolForm
          medicines={medicines}
          treatmentPlans={treatmentPlans}
          protocol={editingProtocol}
          initialValues={initialParams ? { medicine_id: initialParams.medicineId } : null}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingProtocol(null)
            if (onClearParams) onClearParams()
          }}
        />
      </Modal>

      {/* Modal para Planos de Tratamento */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false)
          setEditingPlan(null)
        }}
      >
        <TreatmentPlanForm
          plan={editingPlan}
          onSave={handleSavePlan}
          onCancel={() => {
            setIsPlanModalOpen(false)
            setEditingPlan(null)
          }}
        />
      </Modal>
    </div>
  )
}
