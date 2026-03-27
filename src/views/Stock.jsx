import { useState, useMemo } from 'react'
import { useEffect } from 'react'
import { stockService } from '@shared/services'
import { parseLocalDate } from '@utils/dateUtils'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import EmptyState from '@shared/components/ui/EmptyState'
import StockForm from '@stock/components/StockForm'
import StockCard from '@stock/components/StockCard'
import CostChart from '@stock/components/CostChart'
import PrescriptionTimeline from '@features/stock/components/PrescriptionTimeline'
import { calculateMonthlyCosts } from '@stock/services/costAnalysisService'
import { PRESCRIPTION_STATUS } from '@features/prescriptions/services/prescriptionService'
import { useStockData } from '@stock/hooks/useStockData'
import './Stock.css'

export default function Stock({ initialParams, onClearParams }) {
  // 1. Hook de dados (substitui estados + loadData)
  const {
    items,
    medicines,
    protocols,
    isLoading,
    error: hookError,
    reload: loadData,
  } = useStockData()

  // 2. States locais (apenas UI)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMedicineId, setSelectedMedicineId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState(hookError)

  // 2. Memos
  // Calcular custos mensais (F5.10)
  // Prepara medicines com stock embarcado para o serviço de análise
  const costData = useMemo(() => {
    if (medicines.length === 0 || protocols.length === 0) {
      return { items: [], totalMonthly: 0, projection3m: 0 }
    }

    // Preparar medicines com stock embarcado (extrair entries dos items do hook)
    const medicinesWithStock = medicines.map((medicine) => {
      const item = items.find((i) => i.medicine.id === medicine.id)
      return {
        ...medicine,
        stock: item?.entries || [],
      }
    })

    // Calcular custos
    return calculateMonthlyCosts(medicinesWithStock, protocols)
  }, [medicines, items, protocols])

  // Processar protocolos para PrescriptionTimeline (EV-07)
  const prescriptionTimelineData = useMemo(() => {
    if (protocols.length === 0) return []

    return protocols
      .filter((p) => p.active)
      .map((p) => {
        const endDate = p.end_date
        const isContinuous = !endDate
        let status = PRESCRIPTION_STATUS.VIGENTE
        let daysRemaining = null

        if (!isContinuous) {
          const today = parseLocalDate(new Date().toISOString().slice(0, 10))
          const end = parseLocalDate(endDate)
          const diffTime = end - today
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          daysRemaining = diffDays

          if (diffDays < 0) {
            status = PRESCRIPTION_STATUS.VENCIDA
          } else if (diffDays <= 30) {
            status = PRESCRIPTION_STATUS.VENCENDO
          }
        }

        return {
          id: p.id,
          name: p.name,
          startDate: p.start_date,
          endDate: p.end_date,
          status,
          daysRemaining,
        }
      })
      .sort((a, b) => {
        // Ordenar: vencidas, vencendo, depois vigentes (com deadline antes)
        const statusOrder = { vencida: 0, vencendo: 1, vigente: 2 }
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status]
        }
        // Se mesmo status, ordenar por daysRemaining (menor primeiro)
        if (a.daysRemaining !== null && b.daysRemaining !== null) {
          return a.daysRemaining - b.daysRemaining
        }
        return 0
      })
  }, [protocols])

  // 3. Effects
  // Atualizar hook error para state local (para display)
  useEffect(() => {
    setError(hookError)
  }, [hookError])

  // Deep link: abrir modal pré-selecionado se initialParams passado
  useEffect(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      setSelectedMedicineId(initialParams.medicineId)
      setIsModalOpen(true)
    }
  }, [initialParams, medicines])

  // 4. Handlers
  const handleAddStock = (medicineId = null) => {
    if (medicines.length === 0) {
      setError('Cadastre um medicamento antes de adicionar estoque')
      return
    }
    setSelectedMedicineId(typeof medicineId === 'string' ? medicineId : null)
    setIsModalOpen(true)
  }

  const handleSaveStock = async (stockData) => {
    try {
      await stockService.add(stockData)
      showSuccess('Estoque adicionado com sucesso!')
      setIsModalOpen(false)
      setSelectedMedicineId(null)
      if (onClearParams) onClearParams()
      await loadData()
    } catch (err) {
      const errorMessage = err?.message || 'Erro desconhecido ao adicionar estoque'
      console.error('Stock add error:', err)
      throw new Error(errorMessage)
    }
  }

  const showSuccess = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  // Adaptar items do hook ao formato esperado pelo restante de Stock.jsx
  // Hook retorna shape novo; Stock.jsx espera formato antigo para compatibilidade
  const medicinesWithStock = items.map((item) => ({
    medicine: {
      ...item.medicine,
      id: item.medicine.id,
      name: item.medicine.name,
      dosage_per_pill: item.medicine.dosage_per_pill,
      dosage_unit: item.medicine.dosage_unit,
      medicine_type: item.medicine.medicine_type,
    },
    stock: {
      entries: item.entries,
      total: item.totalQuantity,
      daysRemaining: item.daysRemaining,
      isLow: item.daysRemaining > 0 && item.daysRemaining < 4,
      dailyIntake: item.dailyIntake,
      hasActiveProtocol: item.hasActiveProtocol,
    },
  }))

  // Separar em categorias baseadas na nova regra
  const outOfStockMedicines = medicinesWithStock.filter(
    (item) => item.stock.total === 0 && item.stock.hasActiveProtocol
  )
  const lowStockMedicines = medicinesWithStock
    .filter((item) => item.stock.total > 0 && item.stock.isLow)
    .sort((a, b) => a.stock.daysRemaining - b.stock.daysRemaining)

  const okStockMedicines = medicinesWithStock
    .filter((item) => item.stock.total > 0 && !item.stock.isLow)
    .sort((a, b) => a.stock.daysRemaining - b.stock.daysRemaining)

  if (isLoading) {
    return (
      <div className="stock-view">
        <Loading text="Carregando estoque..." />
      </div>
    )
  }

  return (
    <div className="stock-view">
      <div className="stock-header">
        <div>
          <h2>📦 Estoque</h2>
          <p className="stock-subtitle">
            <span className="live-indicator"></span>
            Sincronizado com protocolos ativos
          </p>
        </div>
        <Button variant="primary" onClick={handleAddStock}>
          ➕ Adicionar Estoque
        </Button>
      </div>

      {successMessage && <div className="success-banner fade-in">✨ {successMessage}</div>}

      {error && <div className="error-banner fade-in">❌ {error}</div>}

      {medicines.length === 0 ? (
        <EmptyState
          illustration="stock"
          title="Nenhum medicamento cadastrado"
          description="Cadastre seus medicamentos para começar a controlar seu estoque"
          ctaLabel="Cadastrar Medicamento"
          onCtaClick={() => (window.location.href = '/medicines/new')}
        />
      ) : (
        <div className="stock-content">
          {/* Alertas críticos: Sem estoque */}
          {outOfStockMedicines.length > 0 && (
            <div className="stock-section fade-in">
              <h3 className="section-title error">
                ❌ Sem Estoque ({outOfStockMedicines.length})
                <span className="section-subtitle">Reposição imediata necessária</span>
              </h3>
              <div className="stock-grid">
                {outOfStockMedicines.map(({ medicine, stock }) => (
                  <StockCard
                    key={medicine.id}
                    medicine={medicine}
                    stockEntries={stock.entries}
                    totalQuantity={stock.total}
                    daysRemaining={stock.daysRemaining}
                    isLow={true}
                    onClick={() => handleAddStock(medicine.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Atenção: Acabando em breve */}
          {lowStockMedicines.length > 0 && (
            <div className="stock-section fade-in">
              <h3 className="section-title warning">
                ⚠️ Acaba em breve ({lowStockMedicines.length})
                <span className="section-subtitle">Menos de 4 dias de cobertura</span>
              </h3>
              <div className="stock-grid">
                {lowStockMedicines.map(({ medicine, stock }) => (
                  <StockCard
                    key={medicine.id}
                    medicine={medicine}
                    stockEntries={stock.entries}
                    totalQuantity={stock.total}
                    daysRemaining={stock.daysRemaining}
                    isLow={true}
                    dailyIntake={stock.dailyIntake}
                    onClick={() => handleAddStock(medicine.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tudo certo: Estoque OK */}
          {okStockMedicines.length > 0 && (
            <div className="stock-section fade-in">
              <h3 className="section-title success">
                📦 Estoque OK ({okStockMedicines.length})
                <span className="section-subtitle">Mais de 4 dias garantidos</span>
              </h3>
              <div className="stock-grid">
                {okStockMedicines.map(({ medicine, stock }) => (
                  <StockCard
                    key={medicine.id}
                    medicine={medicine}
                    stockEntries={stock.entries}
                    totalQuantity={stock.total}
                    daysRemaining={stock.daysRemaining}
                    isLow={false}
                    dailyIntake={stock.dailyIntake}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Prescrições — EV-07 */}
          {prescriptionTimelineData.length > 0 && (
            <div className="stock-section fade-in">
              <h3 className="section-title">
                📋 Prescrições
                <span className="section-subtitle">Status de validade dos protocolos</span>
              </h3>
              <div className="stock-prescriptions">
                {prescriptionTimelineData.map((p) => (
                  <PrescriptionTimeline
                    key={p.id}
                    name={p.name}
                    startDate={p.startDate}
                    endDate={p.endDate}
                    status={p.status}
                    daysRemaining={p.daysRemaining}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custo Mensal — F5.10 */}
          {medicines.length > 0 && (
            <div className="stock-section fade-in">
              <h3 className="section-title">
                💰 Custo Mensal
                <span className="section-subtitle">Análise de gastos com medicamentos</span>
              </h3>
              <CostChart
                items={costData.items}
                totalMonthly={costData.totalMonthly}
                projection3m={costData.projection3m}
                onExpand={null}
              />
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          if (onClearParams) onClearParams()
        }}
      >
        <StockForm
          medicines={medicines}
          initialValues={
            selectedMedicineId
              ? { medicine_id: selectedMedicineId }
              : initialParams
                ? { medicine_id: initialParams.medicineId }
                : null
          }
          onSave={handleSaveStock}
          onCancel={() => {
            setIsModalOpen(false)
            setSelectedMedicineId(null)
            if (onClearParams) onClearParams()
          }}
        />
      </Modal>
    </div>
  )
}
