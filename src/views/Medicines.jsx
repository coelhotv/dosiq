import { useState, useEffect, useCallback } from 'react'
import { medicineService, protocolService, stockService } from '../services/api' // Import protocolService and stockService
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import Modal from '../components/ui/Modal'
import MedicineForm from '../components/medicine/MedicineForm'
import MedicineCard from '../components/medicine/MedicineCard'
import './Medicines.css'

export default function Medicines({ onNavigateToProtocol }) {
  const [medicines, setMedicines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'medicamento', 'suplemento'
  const [medicineDependencies, setMedicineDependencies] = useState({}) // { medicineId: { hasProtocols: boolean, hasStock: boolean } }


  const loadDependencies = useCallback(async (medicines) => {
    const dependencies = {};
    for (const medicine of medicines) {
      const [protocols, stock] = await Promise.all([
        protocolService.getByMedicineId(medicine.id),
        stockService.getByMedicine(medicine.id),
      ]);
      dependencies[medicine.id] = {
        hasProtocols: protocols.length > 0,
        hasStock: stock.length > 0,
      };
    }
    setMedicineDependencies(dependencies);
  }, []);

  const loadMedicines = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await medicineService.getAll()
      setMedicines(data)

      // Load dependencies
      await loadDependencies(data)
    } catch (err) {
      setError('Erro ao carregar medicamentos: ' + err.message)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [loadDependencies]);


  useEffect(() => {
    loadMedicines()
  }, [loadMedicines])

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

        // UX: Offer to create a protocol immediately
        if (window.confirm('✨ Medicamento criado! Deseja criar um protocolo de uso para ele agora?')) {
          if (onNavigateToProtocol) {
            onNavigateToProtocol(newMedicine.id)
            return // Exit early to avoid closing/reloading the current screen unnecessarily
          }
        }
      }

      setIsModalOpen(false)
      setEditingMedicine(null)
      await loadMedicines()
    } catch (err) {
      throw new Error('Erro ao salvar medicamento: ' + err.message)
    }
  }

  const handleDelete = async (medicine) => {
    const hasDependencies = medicineDependencies[medicine.id]?.hasProtocols || medicineDependencies[medicine.id]?.hasStock;

    if (hasDependencies) {
      const confirmation = window.confirm(
        `Este medicamento possui${medicineDependencies[medicine.id].hasProtocols ? 'protocolos e' : ''} ${medicineDependencies[medicine.id].hasStock ? 'estoque' : ''} associado(s).\nTem certeza que deseja excluí-lo?`
      );
      if (!confirmation) {
        return;
      }
    }
    if (!window.confirm(`Tem certeza que deseja excluir "${medicine.name}"?`)) {
      return
    }

    try {
      await medicineService.delete(medicine.id)
      showSuccess('Medicamento excluído com sucesso!')
      await loadMedicines()
    } catch (err) {
      setError('Erro ao excluir medicamento: ' + err.message)
      console.error(err)
    }
  }

  const showSuccess = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  if (isLoading) {
    return (
      <div className="medicines-view">
        <Loading text="Carregando medicamentos..." />
      </div>
    )
  }

  return (
    <div className="medicines-view">
      <div className="medicines-header">
        <div>
          <h2>💊 Medicamentos e Suplementos</h2>
          <p className="medicines-subtitle">
            Gerencie seus medicamentos cadastrados
          </p>
        </div>
        <Button variant="primary" onClick={handleAdd}>
          ➕ Adicionar
        </Button>
      </div>

      <div className="filter-tabs" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <Button
          variant={filterType === 'all' ? 'primary' : 'outline'}
          onClick={() => setFilterType('all')}
          size="sm"
        >
          Todos
        </Button>
        <Button
          variant={filterType === 'medicamento' ? 'primary' : 'outline'}
          onClick={() => setFilterType('medicamento')}
          size="sm"
        >
          Medicamentos
        </Button>
        <Button
          variant={filterType === 'suplemento' ? 'primary' : 'outline'}
          onClick={() => setFilterType('suplemento')}
          size="sm"
        >
          Suplementos
        </Button>
      </div>

      {successMessage && (
        <div className="success-banner fade-in">
          ✅ {successMessage}
        </div>
      )}

      {error && (
        <div className="error-banner fade-in">
          ❌ {error}
        </div>
      )}

      {medicines.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💊</div>
          <h3>Nenhum medicamento cadastrado</h3>
          <p>Comece adicionando seu primeiro medicamento</p>
          <Button variant="primary" onClick={handleAdd}>
            ➕ Adicionar Primeiro Medicamento
          </Button>
        </div>
      ) : (
        <div className="medicines-grid">
          {medicines
            .filter(m => filterType === 'all' || m.type === filterType)
            .map(medicine => {
              const hasDependencies = medicineDependencies[medicine.id]?.hasProtocols || medicineDependencies[medicine.id]?.hasStock;
              return (
                <MedicineCard
                  key={medicine.id}
                  medicine={medicine}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  hasDependencies={hasDependencies} // Pass this prop to MedicineCard
                />
              );
            })}
        </div>
      )}

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
    </div>
  )
}
