import { useState, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { medicineService } from '@shared/services'
import Loading from '@shared/components/ui/Loading'
import MedicineListHeader from '@medications/components/redesign/medicines/components/MedicineListHeader'
import MedicineFilterChips from '@medications/components/redesign/medicines/components/MedicineFilterChips'
import MedicineFeedbackBanners from '@medications/components/redesign/medicines/components/MedicineFeedbackBanners'
import MedicineGrid from '@medications/components/redesign/medicines/components/MedicineGrid'
import MedicineModals from '@medications/components/redesign/medicines/components/MedicineModals'
import '@medications/components/redesign/Medicines.css'

export default function Medicines({ onNavigateToProtocol }) {
  const {
    medicines: contextMedicines,
    protocols,
    stockSummary,
    isLoading,
    refresh,
  } = useDashboard()

  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showProtocolPrompt, setShowProtocolPrompt] = useState(false)
  const [newMedicineId, setNewMedicineId] = useState(null)

  const medicineDependencies = useMemo(() => {
    const deps = {}
    if (!contextMedicines || !protocols || !stockSummary) return deps
    contextMedicines.forEach((med) => {
      const hasProtocols = protocols.some((p) => p.medicine_id === med.id)
      const hasStock = stockSummary.some((s) => s.medicine_id === med.id)
      deps[med.id] = { hasProtocols, hasStock }
    })
    return deps
  }, [contextMedicines, protocols, stockSummary])

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleSave = useCallback(
    async (medicineData) => {
      try {
        if (editingMedicine) {
          await medicineService.update(editingMedicine.id, medicineData)
          showSuccess('Medicamento atualizado com sucesso!')
        } else {
          const newMedicine = await medicineService.create(medicineData)
          showSuccess('Medicamento cadastrado com sucesso!')
          setNewMedicineId(newMedicine.id)
          setShowProtocolPrompt(true)
          setIsModalOpen(false)
          setEditingMedicine(null)
          refresh({ force: true })
          return
        }
        setIsModalOpen(false)
        setEditingMedicine(null)
        refresh({ force: true })
      } catch (err) {
        setError('Erro ao salvar medicamento: ' + err.message)
      }
    },
    [editingMedicine, refresh]
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await medicineService.delete(deleteTarget.id)
      showSuccess('Medicamento excluído com sucesso!')
      refresh({ force: true })
    } catch (err) {
      setError('Erro ao excluir medicamento: ' + err.message)
    } finally {
      setDeleteTarget(null)
    }
  }, [deleteTarget, refresh])

  const handleProtocolPromptConfirm = () => {
    setShowProtocolPrompt(false)
    if (onNavigateToProtocol && newMedicineId) onNavigateToProtocol(newMedicineId)
    setNewMedicineId(null)
  }

  const filteredMedicines = useMemo(
    () => contextMedicines?.filter((m) => filterType === 'all' || m.type === filterType) || [],
    [contextMedicines, filterType]
  )

  if (isLoading) {
    return (
      <div className="sr-medicines">
        <Loading text="Carregando medicamentos..." />
      </div>
    )
  }

  return (
    <div className="sr-medicines">
      <MedicineListHeader onAdd={() => { setEditingMedicine(null); setIsModalOpen(true); }} />
      <MedicineFilterChips filterType={filterType} onFilterChange={setFilterType} />
      <MedicineFeedbackBanners successMessage={successMessage} error={error} />
      <MedicineGrid 
        medicines={contextMedicines} 
        filteredMedicines={filteredMedicines} 
        onAdd={() => { setEditingMedicine(null); setIsModalOpen(true); }}
        onEdit={(medicine) => { setEditingMedicine(medicine); setIsModalOpen(true); }}
        onDelete={setDeleteTarget}
        medicineDependencies={medicineDependencies}
      />
      <MedicineModals 
        isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
        editingMedicine={editingMedicine} setEditingMedicine={setEditingMedicine}
        handleSave={handleSave} deleteTarget={deleteTarget} setDeleteTarget={setDeleteTarget}
        handleDeleteConfirm={handleDeleteConfirm} medicineDependencies={medicineDependencies}
        showProtocolPrompt={showProtocolPrompt} handleProtocolPromptConfirm={handleProtocolPromptConfirm}
        handleProtocolPromptCancel={() => { setShowProtocolPrompt(false); setNewMedicineId(null); setIsModalOpen(false); setEditingMedicine(null); }}
      />
    </div>
  )
}
