/**
 * StockRedesign — View de Estoque redesenhada (Santuário Terapêutico, Wave 8).
 * Orquestra layout, personas (simple/complex) e modal de compra.
 *
 * NÃO duplica lógica de dados — usa useStockData() compartilhado.
 * NÃO modifica Stock.jsx original.
 *
 * Personas:
 * - Simple (Dona Maria): seções por urgência, 2 colunas desktop, "última compra" per-card
 * - Complex (Carlos): grid responsivo, EntradaHistorico, bar-pct%, quantidade visível
 */

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { useStockData } from '@stock/hooks/useStockData'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import Loading from '@shared/components/ui/Loading'
import EmptyState from '@shared/components/ui/EmptyState'
import Modal from '@shared/components/ui/Modal'
import StockForm from '@stock/components/StockForm'
import StockCardRedesign from '@stock/components/redesign/StockCardRedesign'
import CriticalAlertBanner from '@stock/components/redesign/CriticalAlertBanner'
import EntradaHistorico from '@stock/components/redesign/EntradaHistorico'
import { stockService } from '@shared/services'
import './StockRedesign.css'

export default function StockRedesign({ initialParams, onClearParams }) {
  // ── Dados (hook compartilhado) ──
  const { items, criticalItems, warningItems, okItems, highItems, medicines, isLoading, error, reload } = useStockData()

  // ── Complexidade / Persona ──
  // R-152: isComplex = mode !== 'simple'; sem modo "moderate"
  const { mode } = useComplexityMode()
  const isComplex = mode !== 'simple'

  // ── Estado local (UI) ──
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMedicineId, setSelectedMedicineId] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')

  // ── Motion ──
  const motionConfig = useMotion()

  // ── Entries agregadas para histórico (complex only) ──
  const allEntries = useMemo(() => items.flatMap((i) => i.entries), [items])

  // ── Todos os itens ordenados por urgência (para Complex grid) ──
  const sortedAllItems = useMemo(
    () => [...criticalItems, ...warningItems, ...okItems, ...highItems],
    [criticalItems, warningItems, okItems, highItems]
  )

  // ── Handlers ──
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

  // ── initialParams: abrir modal pré-selecionado (deep link) ──
  const modalInitialValues = useMemo(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      setSelectedMedicineId(initialParams.medicineId)
      setIsModalOpen(true)
    }
    return selectedMedicineId ? { medicine_id: selectedMedicineId } : initialParams || null
  }, [initialParams, medicines.length, selectedMedicineId])

  // ── Loading / Error ──
  if (isLoading) {
    return (
      <div className="page-container">
        <Loading text="Carregando estoque..." />
      </div>
    )
  }

  if (medicines.length === 0) {
    return (
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
  }

  // ── Render ──
  return (
    <div className="page-container stock-redesign" data-complexity={mode}>
      {/* ── Page Header ── */}
      <header className="stock-redesign__header">
        <div>
          <h1 className="stock-redesign__title">Controle de Estoque</h1>
          <p className="stock-redesign__subtitle">Prioridade de Reabastecimento</p>
        </div>
        {/* Desktop: botão no header; Mobile: FAB fixo abaixo */}
        <button
          className="stock-redesign__add-btn stock-redesign__add-btn--desktop"
          onClick={() => handleOpenModal()}
          aria-label="Adicionar estoque"
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar Estoque
        </button>
      </header>

      {/* ── Feedback ── */}
      {successMessage && (
        <div className="stock-redesign__success" role="status">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="stock-redesign__error" role="alert">
          {error}
        </div>
      )}

      {/* ── Banner de alerta crítico ── */}
      <CriticalAlertBanner criticalCount={criticalItems.length} onBuyAll={() => handleOpenModal()} />

      {/* ── Seção principal ── */}
      {isComplex ? (
        // Complex: grid único ordenado por urgência; CSS decide 2-col vs 3-col por contagem
        <>
          <div className="stock-redesign__section-header">
            <h2 className="stock-redesign__section-title">Inventário Ativo ({items.length})</h2>
          </div>
          <motion.div
            className="stock-redesign__grid stock-redesign__grid--complex"
            variants={motionConfig.cascade.container}
            initial="hidden"
            animate="visible"
          >
            {sortedAllItems.map((item, index) => (
              <StockCardRedesign
                key={item.medicine.id}
                item={item}
                isComplex={true}
                onAddStock={() => handleOpenModal(item.medicine.id)}
                index={index}
              />
            ))}
          </motion.div>
        </>
      ) : (
        // Simple: seções por urgência (Dona Maria)
        <motion.div className="stock-redesign__sections" variants={motionConfig.cascade.container} initial="hidden" animate="visible">
          {criticalItems.length > 0 && (
            <motion.section variants={motionConfig.cascade.item} className="stock-redesign__section">
              <h2 className="stock-redesign__section-label stock-redesign__section-label--urgente">
                Crítico ({criticalItems.length})
              </h2>
              {criticalItems.map((item, index) => (
                <StockCardRedesign
                  key={item.medicine.id}
                  item={item}
                  isComplex={false}
                  onAddStock={() => handleOpenModal(item.medicine.id)}
                  index={index}
                />
              ))}
            </motion.section>
          )}

          {warningItems.length > 0 && (
            <motion.section variants={motionConfig.cascade.item} className="stock-redesign__section">
              <h2 className="stock-redesign__section-label stock-redesign__section-label--atencao">
                Atenção ({warningItems.length})
              </h2>
              {warningItems.map((item, index) => (
                <StockCardRedesign
                  key={item.medicine.id}
                  item={item}
                  isComplex={false}
                  onAddStock={() => handleOpenModal(item.medicine.id)}
                  index={index}
                />
              ))}
            </motion.section>
          )}

          {(okItems.length > 0 || highItems.length > 0) && (
            <motion.section variants={motionConfig.cascade.item} className="stock-redesign__section">
              <h2 className="stock-redesign__section-label stock-redesign__section-label--seguro">
                Estoque OK ({okItems.length + highItems.length})
              </h2>
              {[...okItems, ...highItems].map((item, index) => (
                <StockCardRedesign
                  key={item.medicine.id}
                  item={item}
                  isComplex={false}
                  onAddStock={() => handleOpenModal(item.medicine.id)}
                  index={index}
                />
              ))}
            </motion.section>
          )}
        </motion.div>
      )}

      {/* ── Histórico de Entradas (complex only) ── */}
      {/* Simple: informação de última compra + custo já está per-card em StockCardRedesign */}
      {/* Complex: Carlos precisa do histórico completo para auditoria e comparação */}
      {isComplex && allEntries.length > 0 && (
        <section className="stock-redesign__history-section">
          <h2 className="stock-redesign__section-title">Histórico de Entradas</h2>
          <EntradaHistorico entries={allEntries} maxVisible={3} />
        </section>
      )}

      {/* ── FAB mobile — fixo acima da BottomNav ── */}
      <button
        className="stock-redesign__fab"
        onClick={() => handleOpenModal()}
        aria-label="Adicionar estoque"
      >
        <Plus size={20} aria-hidden="true" />
      </button>

      {/* ── Modal de compra (reutiliza StockForm original) ── */}
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
          initialValues={modalInitialValues}
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
