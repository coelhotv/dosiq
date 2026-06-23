/**
 * TreatmentsRedesign — Orquestração da view de tratamentos redesenhada
 */
import { useTreatmentsState } from '@protocols/hooks/useTreatmentsState'
import TreatmentTabBar from '@protocols/components/redesign/TreatmentTabBar'
import AnvisaSearchBar from '@protocols/components/redesign/AnvisaSearchBar'
import TreatmentsSimple from './TreatmentsSimple'
import TreatmentsComplex from './TreatmentsComplex'
import Loading from '@shared/components/ui/Loading'
import NewTreatmentDropdown from '@protocols/components/redesign/NewTreatmentDropdown'
import TreatmentModals from './TreatmentModals'
import { treatmentPlanService } from '@shared/services'
import './Treatments.css'

export default function Treatments({ onNavigateToProtocol, onNavigate, onClearInitialMedicine }) {
  const state = useTreatmentsState(onClearInitialMedicine)
  const {
    activeTab, setActiveTab, setWizardOpen, setWizardMedicine,
    setMedicineCreateOpen, setPlanFormOpen, setPlanEditTarget,
    isComplex, loading, error, errorMessage, setErrorMessage,
    currentItems, currentGroups, activeItems, pausedItems, finishedItems,
    handleEditProtocol, setDeleteTreatmentTarget, setDeletePlanTarget,
  } = state

  if (loading) return <Loading />
  if (error) return <div className="treatments-redesign__error">Erro ao carregar tratamentos: {error}</div>

  const handleEditPlan = async (group) => {
    try {
      const planId = group.groupKey.replace('plan:', '')
      const fullPlan = await treatmentPlanService.getById(planId)
      setPlanEditTarget(fullPlan)
      setPlanFormOpen(true)
    } catch { setErrorMessage('Erro ao carregar plano.') }
  }

  return (
    <div className="treatments-redesign">
      <div className="treatments-redesign__topbar">
        <div className="treatments-redesign__topbar-left">
          <h1 className="treatments-redesign__title">Meus Tratamentos</h1>
          <NewTreatmentDropdown
            isComplex={isComplex}
            onAddMedicine={() => setMedicineCreateOpen(true)}
            onAddTreatment={() => { setWizardMedicine(null); setWizardOpen(true); }}
            onAddPlan={() => { setPlanEditTarget(null); setPlanFormOpen(true); }}
          />
        </div>
        <AnvisaSearchBar
          existingProtocols={activeItems}
          onNavigateToProtocol={onNavigateToProtocol}
          onEditProtocol={handleEditProtocol}
          onOpenWizard={(m) => { setWizardMedicine(m); setWizardOpen(true); }}
          onViewAllMedicines={onNavigate ? () => onNavigate('medicines') : undefined}
        />
      </div>

      <TreatmentTabBar
        activeTab={activeTab}
        counts={{ ativos: activeItems.length, pausados: pausedItems.length, finalizados: finishedItems.length }}
        onChange={setActiveTab}
      />

      {errorMessage && (
        <div className="treatments-redesign__error-banner">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="treatments-redesign__error-close">×</button>
        </div>
      )}

      {isComplex ? (
        <TreatmentsComplex
          key={activeTab} groups={currentGroups} onEdit={handleEditProtocol}
          onDelete={setDeleteTreatmentTarget} onEditPlan={handleEditPlan}
          onDeletePlan={(g) => setDeletePlanTarget({ id: g.groupKey.replace('plan:', ''), label: g.groupLabel })}
          activeTab={activeTab}
        />
      ) : (
        <TreatmentsSimple
          key={activeTab} items={currentItems} onEdit={handleEditProtocol}
          onDelete={setDeleteTreatmentTarget} activeTab={activeTab}
        />
      )}

      <TreatmentModals state={state} />
    </div>
  )
}
