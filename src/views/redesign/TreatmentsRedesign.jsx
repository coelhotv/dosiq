/**
 * TreatmentsRedesign — Orquestração da view de tratamentos redesenhada
 * Carrega dados, bifurca por persona, gerencia tabs e modal do wizard
 */
import { useState, useEffect } from 'react'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { useTreatmentList } from '@protocols/hooks/useTreatmentList'
import { medicineService, treatmentPlanService } from '@shared/services'
import TreatmentTabBar from '@protocols/components/redesign/TreatmentTabBar'
import AnvisaSearchBar from '@protocols/components/redesign/AnvisaSearchBar'
import TreatmentsSimple from './TreatmentsSimple'
import TreatmentsComplex from './TreatmentsComplex'
import Loading from '@shared/components/ui/Loading'
import TreatmentWizard from '@protocols/components/TreatmentWizard'
import ProtocolForm from '@protocols/components/ProtocolForm'
import Modal from '@shared/components/ui/Modal'
import { protocolService } from '@shared/services'
import './TreatmentsRedesign.css'

export default function TreatmentsRedesign({ onNavigateToProtocol }) {
  // Estados
  const [activeTab, setActiveTab] = useState('ativos')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMedicine, setWizardMedicine] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formProtocol, setFormProtocol] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [treatmentPlans, setTreatmentPlans] = useState([])
  const [errorMessage, setErrorMessage] = useState(null)

  // Data + context
  const { mode } = useComplexityMode()
  const { activeItems, pausedItems, finishedItems, activeGroups, pausedGroups, finishedGroups, loading, error, refetch } =
    useTreatmentList()

  const isComplex = mode === 'complex'

  // Fetch medicines and treatmentPlans on mount
  useEffect(() => {
    Promise.all([
      medicineService.getAll(),
      treatmentPlanService.getAll(),
    ]).then(([med, plans]) => {
      setMedicines(med || [])
      setTreatmentPlans(plans || [])
    }).catch(err => {
      console.error('Erro ao carregar medicamentos/planos:', err)
    })
  }, [])

  // Memos — item list e groups por tab
  const tabItems = {
    ativos: activeItems,
    pausados: pausedItems,
    finalizados: finishedItems,
  }
  const tabGroups = {
    ativos: activeGroups,
    pausados: pausedGroups,
    finalizados: finishedGroups,
  }
  const currentItems = tabItems[activeTab] || []
  const currentGroups = tabGroups[activeTab] || []

  // Handlers
  function handleOpenWizard(medicine) {
    // Wizard: apenas para medicamentos novos da busca ANVISA
    setWizardMedicine(medicine)
    setWizardOpen(true)
  }

  function handleWizardComplete() {
    setWizardOpen(false)
    setWizardMedicine(null)
    refetch()
  }

  async function handleEditProtocol(protocolItem) {
    // Form: para editar protocolo existente da lista
    // Buscar protocolo completo do banco (TreatmentItem tem estrutura diferente)
    try {
      setErrorMessage(null)
      const fullProtocol = await protocolService.getById(protocolItem.id)
      setFormProtocol(fullProtocol)
      setFormOpen(true)
    } catch (err) {
      console.error('Erro ao carregar protocolo para edicao:', err)
      setErrorMessage('Erro ao carregar protocolo. Tente novamente.')
    }
  }

  function handleFormClose() {
    setFormOpen(false)
    setFormProtocol(null)
  }

  async function handleFormSave(protocolData) {
    try {
      setErrorMessage(null)
      await protocolService.update(formProtocol.id, protocolData)
      handleFormClose()
      refetch()
    } catch (err) {
      console.error('Erro ao salvar protocolo:', err)
      setErrorMessage('Erro ao salvar protocolo. Tente novamente.')
    }
  }

  if (loading) return <Loading />
  if (error) return <div className="treatments-redesign__error">Erro ao carregar tratamentos: {error}</div>

  return (
    <div className="treatments-redesign" data-redesign="true">
      {/* Header */}
      <header className="treatments-redesign__header">
        <h1 className="treatments-redesign__title">Meus Tratamentos</h1>
        <span className="treatments-redesign__count">
          {activeItems.length} protocolo{activeItems.length !== 1 ? 's' : ''} ativo
          {activeItems.length !== 1 ? 's' : ''}
        </span>
      </header>

      {/* Error Banner */}
      {errorMessage && (
        <div className="treatments-redesign__error-banner">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="treatments-redesign__error-close">×</button>
        </div>
      )}

      {/* ANVISA Search */}
      <AnvisaSearchBar
        existingProtocols={activeItems}
        onNavigateToProtocol={onNavigateToProtocol}
        onEditProtocol={handleEditProtocol}
        onOpenWizard={handleOpenWizard}
      />

      {/* Tab Bar */}
      <TreatmentTabBar
        activeTab={activeTab}
        counts={{
          ativos: activeItems.length,
          pausados: pausedItems.length,
          finalizados: finishedItems.length,
        }}
        onChange={setActiveTab}
      />

      {/* Content — bifurca por persona */}
      {isComplex ? (
        <TreatmentsComplex
          key={activeTab}
          groups={currentGroups}
          onEdit={handleEditProtocol}
          activeTab={activeTab}
        />
      ) : (
        <TreatmentsSimple key={activeTab} items={currentItems} onEdit={handleEditProtocol} activeTab={activeTab} />
      )}

      {/* TreatmentWizard modal — apenas para novos protocolos via busca */}
      {wizardOpen && (
        <div className="treatments-redesign__modal-overlay">
          <div className="treatments-redesign__modal">
            <TreatmentWizard
              preselectedMedicine={wizardMedicine}
              onComplete={handleWizardComplete}
              onCancel={() => {
                setWizardOpen(false)
                setWizardMedicine(null)
              }}
            />
          </div>
        </div>
      )}

      {/* ProtocolForm modal — para editar protocolos existentes */}
      <Modal isOpen={formOpen} onClose={handleFormClose}>
        {formProtocol && (
          <ProtocolForm
            medicines={medicines}
            treatmentPlans={treatmentPlans}
            protocol={formProtocol}
            onSave={handleFormSave}
            onCancel={handleFormClose}
            mode="full"
            showTitration={true}
            showTreatmentPlan={true}
          />
        )}
      </Modal>
    </div>
  )
}
