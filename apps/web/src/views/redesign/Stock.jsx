/**
 * StockRedesign — View de Estoque redesenhada (Santuário Terapêutico, Wave 8).
 */
import { useState, useMemo, useEffect, startTransition } from 'react'
import { useStockData } from '@stock/hooks/useStockData'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import Loading from '@shared/components/ui/Loading'
import EmptyState from '@shared/components/ui/EmptyState'
import Modal from '@shared/components/ui/Modal'
import StockForm from '@stock/components/StockForm'
import { calculateMonthlyCosts } from '@stock/services/costAnalysisService'
import { parseLocalDate, getNow } from '@utils/dateUtils'
import { stockService } from '@shared/services'
import StockHeader from './StockHeader'
import StockInventory from './StockInventory'
import './Stock.css'

function deriveProtocolStatus(protocol, now = getNow()) {
  if (!protocol.end_date) return 'ativa'
  const end = parseLocalDate(protocol.end_date)
  const daysLeft = (end - now) / 86400000
  if (daysLeft < 0) return 'vencida'
  if (daysLeft <= 14) return 'vencendo'
  if (protocol.active === false) return 'finalizada'
  return 'ativa'
}

export default function Stock({ initialParams, onClearParams }) {
  const {
    items, criticalItems, warningItems, okItems, highItems, orphanItems, medicines, isLoading, error, reload,
  } = useStockData()

  const { mode } = useComplexityMode()
  const isComplex = mode !== 'simple'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMedicineId, setSelectedMedicineId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const dashboardData = useDashboard()

  const allPurchases = useMemo(() =>
    items.flatMap((item) =>
      item.purchases.map((purchase) => ({
        ...purchase,
        medicineName: item.medicine.name,
        medicineType: item.medicine.medicine_type,
      }))
    ), [items]
  )

  const sortedAllItems = useMemo(() => [
    ...criticalItems, ...warningItems, ...okItems.filter(i => i.hasActiveProtocol),
    ...highItems.filter(i => i.hasActiveProtocol), ...orphanItems,
  ], [criticalItems, warningItems, okItems, highItems, orphanItems])

  const protocols = dashboardData?.protocols

  const costData = useMemo(() => {
    if (!medicines?.length) return null
    const medicinesWithStock = medicines.map((med) => ({
      ...med,
      stock: items?.filter((s) => s.medicine.id === med.id)?.flatMap((s) => s.entries) || [],
      purchases: allPurchases?.filter((p) => p.medicine_id === med.id) || [],
    }))
    try {
      const activeProtocols = protocols?.filter((p) => p.active) || []
      return calculateMonthlyCosts(medicinesWithStock, activeProtocols)
    } catch (err) {
      console.error('[StockRedesign] Erro ao calcular custos:', err)
      return null
    }
  }, [medicines, items, allPurchases, protocols])

  const prescriptionTimelineData = useMemo(() => {
    if (!protocols?.length) return []
    return protocols
      .filter((p) => p.active && p.start_date && p.end_date)
      .map((p) => ({
        id: p.id,
        name: p.name,
        medicineName: p.medicine?.name || medicines?.find((m) => m.id === p.medicine_id)?.name || 'Medicamento',
        startDate: p.start_date,
        endDate: p.end_date,
        status: deriveProtocolStatus(p),
      }))
  }, [protocols, medicines])

  // ═══ Handlers ═══
  const handleOpenModal = (medicineId = null) => {
    if (medicines.length === 0) return
    setSelectedMedicineId(typeof medicineId === 'string' ? medicineId : null)
    setIsModalOpen(true)
  }

  const handleSaveStock = async (stockData) => {
    try {
      await stockService.add(stockData)
      setIsModalOpen(false)
      setSelectedMedicineId(null)
      if (onClearParams) onClearParams()
      setSuccessMessage('Estoque adicionado!')
      setTimeout(() => setSuccessMessage(''), 3000)
      reload()
    } catch (err) {
      throw new Error(err?.message || 'Erro ao adicionar estoque')
    }
  }

  // ═══ Effects ═══
  useEffect(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      startTransition(() => {
        setSelectedMedicineId(initialParams.medicineId)
        setIsModalOpen(true)
      })
    }
  }, [initialParams, medicines.length])

  if (isLoading) return <div className="page-container"><Loading text="Carregando estoque..." /></div>
  if (medicines.length === 0) return (
    <div className="page-container">
      <EmptyState
        illustration="stock"
        title="Nenhum medicamento cadastrado"
        description="Cadastre seus medicamentos para começar a controlar seu estoque"
        ctaLabel="Cadastrar Medicamento"
        onCtaClick={() => handleOpenModal()}
      />
    </div>
  )

  return (
    <div className="page-container stock-redesign" data-complexity={mode}>
      <StockHeader onAddStock={handleOpenModal} />
      {successMessage && <div className="stock-redesign__success" role="status">{successMessage}</div>}
      {error && <div className="stock-redesign__error" role="alert">{error}</div>}

      <StockInventory
        isComplex={isComplex}
        items={items}
        criticalItems={criticalItems}
        warningItems={warningItems}
        okItems={okItems}
        highItems={highItems}
        orphanItems={orphanItems}
        sortedAllItems={sortedAllItems}
        allPurchases={allPurchases}
        costData={costData}
        prescriptionTimelineData={prescriptionTimelineData}
        handleOpenModal={handleOpenModal}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedMedicineId(null)
          if (onClearParams) onClearParams()
        }}
      >
        <StockForm
          medicines={medicines}
          initialValues={selectedMedicineId ? { medicine_id: selectedMedicineId } : (initialParams || {})}
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
