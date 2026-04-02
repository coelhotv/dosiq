/**
 * TreatmentsRedesign — Orquestração da view de tratamentos redesenhada
 * Carrega dados, bifurca por persona, gerencia tabs e modal do wizard
 */
import { useState, useEffect } from 'react'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useTreatmentList } from '@protocols/hooks/useTreatmentList'
import { medicineService, treatmentPlanService } from '@shared/services'
import TreatmentTabBar from '@protocols/components/redesign/TreatmentTabBar'
import AnvisaSearchBar from '@protocols/components/redesign/AnvisaSearchBar'
import TreatmentsSimple from './TreatmentsSimple'
import TreatmentsComplex from './TreatmentsComplex'
import Loading from '@shared/components/ui/Loading'
import TreatmentWizard from '@protocols/components/TreatmentWizard'
import ProtocolForm from '@protocols/components/ProtocolForm'
import TreatmentPlanForm from '@protocols/components/TreatmentPlanForm'
import MedicineForm from '@medications/components/MedicineForm'
import NewTreatmentDropdown from '@protocols/components/redesign/NewTreatmentDropdown'
import Modal from '@shared/components/ui/Modal'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
import { protocolService } from '@shared/services'
import './TreatmentsRedesign.css'

export default function TreatmentsRedesign({ onNavigateToProtocol, onNavigate, initialMedicineId, onClearInitialMedicine }) {
  // Estados
  const [activeTab, setActiveTab] = useState('ativos')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMedicine, setWizardMedicine] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formProtocol, setFormProtocol] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [treatmentPlans, setTreatmentPlans] = useState([])
  const [errorMessage, setErrorMessage] = useState(null)
  const [medicineCreateOpen, setMedicineCreateOpen] = useState(false)
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [planEditTarget, setPlanEditTarget] = useState(null)
  const [deletePlanTarget, setDeletePlanTarget] = useState(null)
  const [deleteTreatmentTarget, setDeleteTreatmentTarget] = useState(null)

  // Data + context
  const { mode } = useComplexityMode()
  const { refresh } = useDashboard()
  const {
    activeItems,
    pausedItems,
    finishedItems,
    activeGroups,
    pausedGroups,
    finishedGroups,
    loading,
    error,
    refetch,
  } = useTreatmentList()

  const isComplex = mode === 'complex'

  // Auto-abrir wizard com medicamento pré-selecionado (fluxo: novo medicamento → novo tratamento)
  useEffect(() => {
    if (!initialMedicineId) return
    medicineService.getById(initialMedicineId)
      .then((medicine) => {
        if (medicine) {
          setWizardMedicine(medicine)
          setWizardOpen(true)
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar medicamento inicial:', err)
      })
      .finally(() => {
        onClearInitialMedicine?.()
      })
  }, [initialMedicineId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch medicines and treatmentPlans on mount
  useEffect(() => {
    Promise.all([medicineService.getAll(), treatmentPlanService.getAll()])
      .then(([med, plans]) => {
        setMedicines(med || [])
        setTreatmentPlans(plans || [])
      })
      .catch((err) => {
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

  // Handlers do dropdown [+ Novo]
  function handleAddMedicine() {
    // MedicineForm: cadastra apenas o medicamento, sem protocolo
    setMedicineCreateOpen(true)
  }

  function handleAddTreatment() {
    // TreatmentWizard sem preselectedMedicine = step 1 livre (med + dosagem em um fluxo)
    setWizardMedicine(null)
    setWizardOpen(true)
  }

  function handleAddPlan() {
    // TreatmentPlanForm: cria agrupador de tratamentos
    setPlanEditTarget(null)
    setPlanFormOpen(true)
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
      setErrorMessage('Erro ao carregar tratamento. Tente novamente.')
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
      setErrorMessage('Erro ao salvar tratamento. Tente novamente.')
    }
  }

  async function handleEditPlan(group) {
    try {
      setErrorMessage(null)
      const planId = group.groupKey.replace('plan:', '')
      const fullPlan = await treatmentPlanService.getById(planId)
      setPlanEditTarget(fullPlan)
      setPlanFormOpen(true)
    } catch (err) {
      console.error('Erro ao carregar plano para edicao:', err)
      setErrorMessage('Erro ao carregar plano. Tente novamente.')
    }
  }

  function handleDeletePlanRequest(group) {
    const planId = group.groupKey.replace('plan:', '')
    setDeletePlanTarget({ id: planId, label: group.groupLabel })
  }

  function handleDeleteTreatmentRequest(item) {
    setDeleteTreatmentTarget(item)
  }

  async function handleDeleteTreatmentConfirm() {
    if (!deleteTreatmentTarget) return
    try {
      setErrorMessage(null)
      await protocolService.delete(deleteTreatmentTarget.id)
      setDeleteTreatmentTarget(null)
      refetch()
    } catch (err) {
      console.error('Erro ao excluir tratamento:', err)
      setErrorMessage('Erro ao excluir tratamento. Tente novamente.')
      setDeleteTreatmentTarget(null)
    }
  }

  async function handleDeletePlanConfirm() {
    if (!deletePlanTarget) return
    try {
      setErrorMessage(null)
      await treatmentPlanService.delete(deletePlanTarget.id)
      setDeletePlanTarget(null)
      refetch()
    } catch (err) {
      console.error('Erro ao excluir plano:', err)
      setErrorMessage('Erro ao excluir plano. Tente novamente.')
      setDeletePlanTarget(null)
    }
  }

  if (loading) return <Loading />
  if (error)
    return <div className="treatments-redesign__error">Erro ao carregar tratamentos: {error}</div>

  return (
    <div className="treatments-redesign" data-redesign="true">
      {/* Top bar: título + dropdown (esq) + busca ANVISA (dir) */}
      <div className="treatments-redesign__topbar">
        <div className="treatments-redesign__topbar-left">
          <h1 className="treatments-redesign__title">Meus Tratamentos</h1>
          <NewTreatmentDropdown
            isComplex={isComplex}
            onAddMedicine={handleAddMedicine}
            onAddTreatment={handleAddTreatment}
            onAddPlan={handleAddPlan}
          />
        </div>
        <AnvisaSearchBar
          existingProtocols={activeItems}
          onNavigateToProtocol={onNavigateToProtocol}
          onEditProtocol={handleEditProtocol}
          onOpenWizard={handleOpenWizard}
          onViewAllMedicines={onNavigate ? () => onNavigate('medicines') : undefined}
        />
      </div>


      {/* Tab bar — abaixo do título, alinhada à esquerda */}
      <TreatmentTabBar
        activeTab={activeTab}
        counts={{
          ativos: activeItems.length,
          pausados: pausedItems.length,
          finalizados: finishedItems.length,
        }}
        onChange={setActiveTab}
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="treatments-redesign__error-banner">
          <p>{errorMessage}</p>
          <button
            onClick={() => setErrorMessage(null)}
            className="treatments-redesign__error-close"
          >
            ×
          </button>
        </div>
      )}

      {/* Content — bifurca por persona */}
      {isComplex ? (
        <TreatmentsComplex
          key={activeTab}
          groups={currentGroups}
          onEdit={handleEditProtocol}
          onDelete={handleDeleteTreatmentRequest}
          onEditPlan={handleEditPlan}
          onDeletePlan={handleDeletePlanRequest}
          activeTab={activeTab}
        />
      ) : (
        <TreatmentsSimple
          key={activeTab}
          items={currentItems}
          onEdit={handleEditProtocol}
          onDelete={handleDeleteTreatmentRequest}
          activeTab={activeTab}
        />
      )}

      {/* TreatmentWizard modal — busca ANVISA (com med pré-selecionado) ou dropdown "+ Medicamento" (livre) */}
      <Modal
        isOpen={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          setWizardMedicine(null)
        }}
      >
        <TreatmentWizard
          preselectedMedicine={wizardMedicine || undefined}
          onComplete={handleWizardComplete}
          onCancel={() => {
            setWizardOpen(false)
            setWizardMedicine(null)
          }}
        />
      </Modal>

      {/* ProtocolForm modal — editar tratamento existente */}
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

      {/* MedicineForm modal — criar medicamento via dropdown "+ Medicamento" */}
      <Modal isOpen={medicineCreateOpen} onClose={() => setMedicineCreateOpen(false)}>
        {medicineCreateOpen && (
          <MedicineForm
            onSave={async (data) => {
              const saved = await medicineService.create(data)
              setMedicineCreateOpen(false)
              // Invalida cache do dashboard (usado por MedicinesRedesign) + lista de tratamentos
              refresh({ force: true })
              refetch()
              return saved
            }}
            onCancel={() => setMedicineCreateOpen(false)}
          />
        )}
      </Modal>

      {/* TreatmentPlanForm modal — criar/editar plano de tratamento */}
      <Modal
        isOpen={planFormOpen}
        onClose={() => {
          setPlanFormOpen(false)
          setPlanEditTarget(null)
        }}
      >
        {planFormOpen && (
          <TreatmentPlanForm
            plan={planEditTarget || undefined}
            onSave={async (data) => {
              if (planEditTarget) {
                await treatmentPlanService.update(planEditTarget.id, data)
              } else {
                await treatmentPlanService.create(data)
              }
              setPlanFormOpen(false)
              setPlanEditTarget(null)
              refetch()
            }}
            onCancel={() => {
              setPlanFormOpen(false)
              setPlanEditTarget(null)
            }}
          />
        )}
      </Modal>

      {/* ConfirmDialog — excluir tratamento */}
      <ConfirmDialog
        isOpen={!!deleteTreatmentTarget}
        title={`Excluir tratamento "${deleteTreatmentTarget?.medicineName}"?`}
        message="Esta ação não pode ser desfeita. O histórico de doses associado será mantido."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeleteTreatmentConfirm}
        onCancel={() => setDeleteTreatmentTarget(null)}
      />

      {/* ConfirmDialog — excluir plano de tratamento */}
      <ConfirmDialog
        isOpen={!!deletePlanTarget}
        title={`Excluir plano "${deletePlanTarget?.label}"?`}
        message="Os tratamentos associados a este plano não serão excluídos, apenas o agrupamento. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeletePlanConfirm}
        onCancel={() => setDeletePlanTarget(null)}
      />
    </div>
  )
}
