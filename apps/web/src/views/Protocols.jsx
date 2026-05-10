import { useState, useEffect, useCallback, startTransition } from 'react'
import { medicineService, protocolService, treatmentPlanService } from '@shared/services'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import ProtocolsContent from './ProtocolsContent'
import ProtocolsModals from './ProtocolsModals'
import { useProtocolHandlers } from './useProtocolHandlers'
import { calculateTitrationData } from '@utils/titrationUtils'
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

  const showSuccess = useCallback((message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [medicinesData, protocolsData, plansData] = await Promise.all([
        medicineService.getAll(),
        protocolService.getAll(),
        treatmentPlanService.getAll(),
      ])
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
    startTransition(() => {
      loadData()
    })
  }, [loadData])

  useEffect(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      startTransition(() => {
        setIsModalOpen(true)
        setEditingProtocol(null)
      })
    }
  }, [initialParams, medicines])

  const handlers = useProtocolHandlers({
    medicines,
    editingProtocol,
    editingPlan,
    onClearParams,
    onNavigateToStock,
    setError,
    setIsModalOpen,
    setIsPlanModalOpen,
    setEditingProtocol,
    setEditingPlan,
    showSuccess,
    loadData,
  })

  const activeProtocols = protocols.filter((p) => p.active)
  const inactiveProtocols = protocols.filter((p) => !p.active)

  if (isLoading) {
    return <div className="protocols-view"><Loading text="Carregando tratamentos..." /></div>
  }

  return (
    <div className="protocols-view">
      <div className="protocols-header">
        <div>
          <h2>📋 Protocolos</h2>
          <p className="protocols-subtitle">Gerencie seus protocolos e planos de tratamento agrupados</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" onClick={handlers.handleAddPlan}>📁 Novo Plano (Grupo)</Button>
          <Button variant="primary" onClick={handlers.handleAdd}>➕ Criar Protocolo</Button>
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
        <ProtocolsContent
          treatmentPlans={treatmentPlans}
          activeProtocols={activeProtocols}
          inactiveProtocols={inactiveProtocols}
          onEditPlan={handlers.handleEditPlan}
          onDeletePlan={handlers.handleDeletePlan}
          onEdit={handlers.handleEdit}
          onToggleActive={handlers.handleToggleActive}
          onDelete={handlers.handleDelete}
        />
      )}

      <ProtocolsModals
        isModalOpen={isModalOpen}
        isPlanModalOpen={isPlanModalOpen}
        editingProtocol={editingProtocol}
        editingPlan={editingPlan}
        medicines={medicines}
        treatmentPlans={treatmentPlans}
        initialParams={initialParams}
        onSave={handlers.handleSave}
        onSavePlan={handlers.handleSavePlan}
        onCloseProtocol={handlers.handleCloseProtocol}
        onClosePlan={handlers.handleClosePlan}
      />
    </div>
  )
}
