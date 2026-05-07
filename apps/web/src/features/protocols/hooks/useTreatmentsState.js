/**
 * useTreatmentsState — Hook de lógica para a view de tratamentos.
 */
import { useState, useEffect } from 'react'
import { medicineService, treatmentPlanService, protocolService } from '@shared/services'
import { useTreatmentList } from '@protocols/hooks/useTreatmentList'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'

export function useTreatmentsState(onClearInitialMedicine) {
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

  const { mode } = useComplexityMode()
  const { refresh } = useDashboard()
  const {
    activeItems, pausedItems, finishedItems,
    activeGroups, pausedGroups, finishedGroups,
    loading, error, refetch,
  } = useTreatmentList()

  const isComplex = mode === 'complex'

  // Fetch initial medicine
  useEffect(() => {
    const initialId = localStorage.getItem('dosiq_initial_medicine_id')
    if (initialId) {
      medicineService.getById(initialId).then(medicine => {
        if (medicine) {
          setWizardMedicine(medicine)
          setWizardOpen(true)
        }
      }).catch(err => console.error(err))
      .finally(() => {
        localStorage.removeItem('dosiq_initial_medicine_id')
        onClearInitialMedicine?.()
      })
    }
  }, [onClearInitialMedicine])

  // Fetch medicines and plans
  useEffect(() => {
    Promise.all([medicineService.getAll(), treatmentPlanService.getAll()])
      .then(([med, plans]) => {
        setMedicines(med || [])
        setTreatmentPlans(plans || [])
      })
      .catch(err => console.error(err))
  }, [])

  const currentItems = { ativos: activeItems, pausados: pausedItems, finalizados: finishedItems }[activeTab] || []
  const currentGroups = { ativos: activeGroups, pausados: pausedGroups, finalizados: finishedGroups }[activeTab] || []

  const handleEditProtocol = async (protocolItem) => {
    try {
      setErrorMessage(null)
      const fullProtocol = await protocolService.getById(protocolItem.id)
      setFormProtocol(fullProtocol)
      setFormOpen(true)
    } catch {
      setErrorMessage('Erro ao carregar tratamento.')
    }
  }

  const handleDeleteTreatmentConfirm = async () => {
    if (!deleteTreatmentTarget) return
    try {
      await protocolService.delete(deleteTreatmentTarget.id)
      setDeleteTreatmentTarget(null)
      refetch()
    } catch {
      setErrorMessage('Erro ao excluir tratamento.')
      setDeleteTreatmentTarget(null)
    }
  }

  const handleDeletePlanConfirm = async () => {
    if (!deletePlanTarget) return
    try {
      await treatmentPlanService.delete(deletePlanTarget.id)
      setDeletePlanTarget(null)
      refetch()
    } catch {
      setErrorMessage('Erro ao excluir plano.')
      setDeletePlanTarget(null)
    }
  }

  return {
    activeTab, setActiveTab,
    wizardOpen, setWizardOpen,
    wizardMedicine, setWizardMedicine,
    formOpen, setFormOpen,
    formProtocol, setFormProtocol,
    medicines, treatmentPlans,
    errorMessage, setErrorMessage,
    medicineCreateOpen, setMedicineCreateOpen,
    planFormOpen, setPlanFormOpen,
    planEditTarget, setPlanEditTarget,
    deletePlanTarget, setDeletePlanTarget,
    deleteTreatmentTarget, setDeleteTreatmentTarget,
    isComplex, loading, error, refetch, refresh,
    currentItems, currentGroups,
    activeItems, pausedItems, finishedItems,
    handleEditProtocol, handleDeleteTreatmentConfirm, handleDeletePlanConfirm,
  }
}
