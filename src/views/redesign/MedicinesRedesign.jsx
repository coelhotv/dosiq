import { useState, useEffect, useCallback } from 'react'
import { Pill, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { medicineService, protocolService, stockService } from '@shared/services'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import EmptyState from '@shared/components/ui/EmptyState'
import MedicineForm from '@medications/components/MedicineForm'
import MedicineCardRedesign from '@medications/components/redesign/MedicineCardRedesign'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
import './MedicinesRedesign.css'

export default function MedicinesRedesign({ onNavigateToProtocol }) {
  // 1. States
  const [medicines, setMedicines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [medicineDependencies, setMedicineDependencies] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showProtocolPrompt, setShowProtocolPrompt] = useState(false)
  const [newMedicineId, setNewMedicineId] = useState(null)

  // 2. Load medicines and dependencies
  const loadMedicines = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const meds = await medicineService.getAll()
      setMedicines(meds)
      await loadDependencies(meds)
    } catch (err) {
      setError('Erro ao carregar medicamentos: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadDependencies = useCallback(async (meds) => {
    const deps = {}
    for (const med of meds) {
      const [protocols, stock] = await Promise.all([
        protocolService.getByMedicineId(med.id),
        stockService.getByMedicine(med.id),
      ])
      deps[med.id] = {
        hasProtocols: protocols.length > 0,
        hasStock: stock.length > 0,
      }
    }
    setMedicineDependencies(deps)
  }, [])

  useEffect(() => {
    loadMedicines()
  }, [loadMedicines])

  // 3. Feedback handlers
  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  // 4. Action handlers
  const handleAdd = () => {
    setEditingMedicine(null)
    setIsModalOpen(true)
  }

  const handleEdit = (medicine) => {
    setEditingMedicine(medicine)
    setIsModalOpen(true)
  }

  const handleSave = async (medicineData) => {
    try {
      if (editingMedicine) {
        await medicineService.update(editingMedicine.id, medicineData)
        showSuccess('Medicamento atualizado com sucesso!')
      } else {
        const newMedicine = await medicineService.create(medicineData)
        showSuccess('Medicamento cadastrado com sucesso!')
        // Show protocol prompt instead of window.confirm()
        setNewMedicineId(newMedicine.id)
        setShowProtocolPrompt(true)
        return // Don't close modal yet
      }
      setIsModalOpen(false)
      setEditingMedicine(null)
      await loadMedicines()
    } catch (err) {
      setError('Erro ao salvar medicamento: ' + err.message)
    }
  }

  const handleDeleteRequest = (medicine) => {
    setDeleteTarget(medicine)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await medicineService.delete(deleteTarget.id)
      showSuccess('Medicamento excluído com sucesso!')
      await loadMedicines()
    } catch (err) {
      setError('Erro ao excluir medicamento: ' + err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleProtocolPromptConfirm = () => {
    setShowProtocolPrompt(false)
    if (onNavigateToProtocol && newMedicineId) {
      onNavigateToProtocol(newMedicineId)
    }
    setNewMedicineId(null)
  }

  const handleProtocolPromptCancel = () => {
    setShowProtocolPrompt(false)
    setNewMedicineId(null)
  }

  // 5. Derived state
  const filteredMedicines = medicines.filter(
    (m) => filterType === 'all' || m.type === filterType
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
      {/* Header */}
      <div className="sr-medicines__header">
        <div>
          <div className="sr-medicines__title-group">
            <div className="sr-medicines__title-icon">
              <Pill size={22} />
            </div>
            <h2 className="sr-medicines__title">Medicamentos</h2>
          </div>
          <p className="sr-medicines__subtitle">
            Gerencie seus medicamentos cadastrados
          </p>
        </div>
        <button className="btn-primary" onClick={handleAdd}>
          <Plus size={18} /> Adicionar
        </button>
      </div>

      {/* Filter Chips */}
      <div className="sr-medicines__filters">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'medicamento', label: 'Medicamentos' },
          { key: 'suplemento', label: 'Suplementos' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`sr-filter-chip ${filterType === key ? 'sr-filter-chip--active' : ''}`}
            onClick={() => setFilterType(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feedback Banners */}
      {successMessage && (
        <div className="sr-medicines__success">
          <CheckCircle2 size={18} /> {successMessage}
        </div>
      )}
      {error && (
        <div className="sr-medicines__error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Content */}
      {medicines.length === 0 ? (
        <EmptyState
          illustration="protocols"
          title="Nenhum medicamento cadastrado"
          description="Cadastre seus medicamentos para começar a controlar sua saúde"
          ctaLabel="Cadastrar Medicamento"
          onCtaClick={handleAdd}
        />
      ) : (
        <div className="sr-medicines__grid">
          {filteredMedicines.map((medicine) => (
            <MedicineCardRedesign
              key={medicine.id}
              medicine={medicine}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              hasDependencies={
                medicineDependencies[medicine.id]?.hasProtocols ||
                medicineDependencies[medicine.id]?.hasStock
              }
            />
          ))}
        </div>
      )}

      {/* Modal: Edit/Create */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingMedicine(null)
        }}
      >
        <MedicineForm
          medicine={editingMedicine}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingMedicine(null)
          }}
        />
      </Modal>

      {/* ConfirmDialog: Delete */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Excluir "${deleteTarget?.name}"?`}
        message={
          medicineDependencies[deleteTarget?.id]?.hasProtocols ||
          medicineDependencies[deleteTarget?.id]?.hasStock
            ? 'Este medicamento possui protocolos e/ou estoque associados. Esta ação não pode ser desfeita.'
            : 'Esta ação não pode ser desfeita.'
        }
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ConfirmDialog: Create Protocol Prompt */}
      <ConfirmDialog
        isOpen={showProtocolPrompt}
        title="Medicamento criado!"
        message="Deseja criar um protocolo de uso para ele agora?"
        confirmLabel="Criar Protocolo"
        cancelLabel="Depois"
        variant="default"
        onConfirm={handleProtocolPromptConfirm}
        onCancel={handleProtocolPromptCancel}
      />
    </div>
  )
}
