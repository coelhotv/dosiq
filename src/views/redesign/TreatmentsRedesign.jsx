/**
 * TreatmentsRedesign — Orquestração da view de tratamentos redesenhada
 * Carrega dados, bifurca por persona, gerencia tabs e modal do wizard
 */
import { useState } from 'react'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { useTreatmentList } from '@protocols/hooks/useTreatmentList'
import TreatmentTabBar from '@protocols/components/redesign/TreatmentTabBar'
import AnvisaSearchBar from '@protocols/components/redesign/AnvisaSearchBar'
import TreatmentsSimple from './TreatmentsSimple'
import TreatmentsComplex from './TreatmentsComplex'
import Loading from '@shared/components/ui/Loading'
import TreatmentWizard from '@protocols/components/TreatmentWizard'
import './TreatmentsRedesign.css'

export default function TreatmentsRedesign({ onNavigateToProtocol }) {
  // Estados
  const [activeTab, setActiveTab] = useState('ativos')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMedicine, setWizardMedicine] = useState(null)

  // Data + context
  const { isComplex } = useComplexityMode()
  const { activeItems, pausedItems, finishedItems, groups, loading, error, refetch } =
    useTreatmentList()

  // Memos — item list por tab
  const tabItems = {
    ativos: activeItems,
    pausados: pausedItems,
    finalizados: finishedItems,
  }
  const currentItems = tabItems[activeTab] || []

  // Handlers
  function handleOpenWizard(medicine) {
    setWizardMedicine(medicine)
    setWizardOpen(true)
  }

  function handleWizardComplete() {
    setWizardOpen(false)
    setWizardMedicine(null)
    refetch()
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

      {/* ANVISA Search */}
      <AnvisaSearchBar
        existingProtocols={activeItems}
        onNavigateToProtocol={onNavigateToProtocol}
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
          groups={activeTab === 'ativos' ? groups : []}
        />
      ) : (
        <TreatmentsSimple items={currentItems} />
      )}

      {/* TreatmentWizard modal */}
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
    </div>
  )
}
