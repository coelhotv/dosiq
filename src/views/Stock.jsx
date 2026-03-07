import { useState, useEffect, useMemo } from 'react'
import { medicineService, stockService, protocolService } from '@shared/services'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import EmptyState from '@shared/components/ui/EmptyState'
import StockForm from '@stock/components/StockForm'
import StockCard from '@stock/components/StockCard'
import CostChart from '@stock/components/CostChart'
import { calculateMonthlyCosts } from '@stock/services/costAnalysisService'
import './Stock.css'

export default function Stock({ initialParams, onClearParams }) {
  const [medicines, setMedicines] = useState([])
  const [protocols, setProtocols] = useState([])
  const [stockData, setStockData] = useState({}) // { medicineId: { entries: [], total: 0, ...status } }
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMedicineId, setSelectedMedicineId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [medicinesData, protocolsData] = await Promise.all([
        medicineService.getAll(),
        protocolService.getActive(),
      ])

      // Salvar protocols para useMemo calcular custos
      setProtocols(protocolsData)

      // Calcular consumo diário por medicamento
      const dailyIntakeMap = {}
      const activeMedicineIds = new Set(protocolsData.map((p) => p.medicine_id))

      protocolsData.forEach((p) => {
        if (p.active) {
          const daily = (p.dosage_per_intake || 0) * (p.time_schedule?.length || 0)
          dailyIntakeMap[p.medicine_id] = (dailyIntakeMap[p.medicine_id] || 0) + daily
        }
      })

      setMedicines(medicinesData)

      // Carregar estoque para cada medicamento
      const stockPromises = medicinesData.map(async (medicine) => {
        const entries = await stockService.getByMedicine(medicine.id)
        const total = entries.reduce((sum, entry) => sum + entry.quantity, 0)

        const dailyIntake = dailyIntakeMap[medicine.id] || 0
        const daysRemaining = dailyIntake > 0 ? total / dailyIntake : Infinity
        const isLow = dailyIntake > 0 && daysRemaining < 4

        return {
          medicineId: medicine.id,
          hasActiveProtocol: activeMedicineIds.has(medicine.id),
          entries,
          total,
          dailyIntake,
          daysRemaining,
          isLow,
        }
      })

      const stockResults = await Promise.all(stockPromises)

      // Organizar dados de estoque por medicamento
      const stockMap = {}
      stockResults.forEach((result) => {
        stockMap[result.medicineId] = {
          hasActiveProtocol: result.hasActiveProtocol,
          entries: result.entries,
          total: result.total,
          dailyIntake: result.dailyIntake,
          daysRemaining: result.daysRemaining,
          isLow: result.isLow,
        }
      })

      setStockData(stockMap)
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      setIsModalOpen(true)
    }
  }, [initialParams, medicines])

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

  // Calcular custos mensais (F5.10)
  // Prepara medicines com stock embarcado para o serviço de análise
  const costData = useMemo(() => {
    if (medicines.length === 0 || protocols.length === 0) {
      return { items: [], totalMonthly: 0, projection3m: 0 }
    }

    // Preparar medicines com stock embarcado
    const medicinesWithStock = medicines.map((medicine) => ({
      ...medicine,
      stock: stockData[medicine.id]?.entries || [],
    }))

    // Calcular custos
    return calculateMonthlyCosts(medicinesWithStock, protocols)
  }, [medicines, protocols, stockData])

  // Filtrar medicamentos que têm estoque ou foram cadastrados
  const medicinesWithStock = medicines.map((medicine) => ({
    medicine,
    stock: stockData[medicine.id] || {
      entries: [],
      total: 0,
      daysRemaining: Infinity,
      isLow: false,
      dailyIntake: 0,
      hasActiveProtocol: false,
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
