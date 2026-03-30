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

import { useState, useMemo, useEffect, startTransition } from 'react'
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
  const {
    items,
    criticalItems,
    warningItems,
    okItems,
    highItems,
    orphanItems,
    medicines,
    isLoading,
    error,
    reload,
  } = useStockData()

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
  // Inclui medicamento info em cada entry para o layout correto
  const allEntries = useMemo(
    () =>
      items.flatMap((item) =>
        item.entries.map((entry) => ({
          ...entry,
          medicineName: item.medicine.name,
          medicineType: item.medicine.medicine_type,
        }))
      ),
    [items]
  )

  // ── Todos os itens ordenados por urgência (para Complex grid) ──
  // Filtra órfãos de okItems/highItems, eles aparecem só no final
  const okItemsWithoutOrphans = useMemo(() => okItems.filter((i) => i.hasActiveProtocol), [okItems])
  const highItemsWithoutOrphans = useMemo(
    () => highItems.filter((i) => i.hasActiveProtocol),
    [highItems]
  )

  // Órfãos (sem protocolo ativo) vão para o FINAL da listagem
  const sortedAllItems = useMemo(
    () => [
      ...criticalItems,
      ...warningItems,
      ...okItemsWithoutOrphans,
      ...highItemsWithoutOrphans,
      ...orphanItems,
    ],
    [criticalItems, warningItems, okItemsWithoutOrphans, highItemsWithoutOrphans, orphanItems]
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
  useEffect(() => {
    if (initialParams?.medicineId && medicines.length > 0) {
      startTransition(() => {
        setSelectedMedicineId(initialParams.medicineId)
        setIsModalOpen(true)
      })
    }
  }, [initialParams, medicines.length])

  const modalInitialValues = selectedMedicineId
    ? { medicine_id: selectedMedicineId }
    : initialParams || null

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
        {/* Botão responsivo: ícone mobile, texto + ícone desktop */}
        <button
          className="stock-redesign__add-btn stock-redesign__add-btn--desktop"
          onClick={() => handleOpenModal()}
          aria-label="Adicionar estoque"
        >
          <Plus size={16} aria-hidden="true" />
          <span>Adicionar Estoque</span>
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
      <CriticalAlertBanner
        criticalCount={criticalItems.length}
        onBuyAll={() => handleOpenModal()}
      />

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
        // Simple: seções por urgência (Dona Maria) — headers fora do grid
        <motion.div
          className="stock-redesign__sections"
          variants={motionConfig.cascade.container}
          initial="hidden"
          animate="visible"
        >
          {criticalItems.length > 0 && (
            <>
              <h2 className="stock-redesign__section-label stock-redesign__section-label--urgente">
                Crítico ({criticalItems.length})
              </h2>
              <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
                {criticalItems.map((item, index) => (
                  <StockCardRedesign
                    key={item.medicine.id}
                    item={item}
                    isComplex={false}
                    onAddStock={() => handleOpenModal(item.medicine.id)}
                    index={index}
                  />
                ))}
              </motion.div>
            </>
          )}

          {warningItems.length > 0 && (
            <>
              <h2 className="stock-redesign__section-label stock-redesign__section-label--atencao">
                Atenção ({warningItems.length})
              </h2>
              <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
                {warningItems.map((item, index) => (
                  <StockCardRedesign
                    key={item.medicine.id}
                    item={item}
                    isComplex={false}
                    onAddStock={() => handleOpenModal(item.medicine.id)}
                    index={index}
                  />
                ))}
              </motion.div>
            </>
          )}

          {(okItemsWithoutOrphans.length > 0 || highItemsWithoutOrphans.length > 0) && (
            <>
              <h2 className="stock-redesign__section-label stock-redesign__section-label--seguro">
                Estoque OK ({okItemsWithoutOrphans.length + highItemsWithoutOrphans.length})
              </h2>
              <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
                {[...okItemsWithoutOrphans, ...highItemsWithoutOrphans].map((item, index) => (
                  <StockCardRedesign
                    key={item.medicine.id}
                    item={item}
                    isComplex={false}
                    onAddStock={() => handleOpenModal(item.medicine.id)}
                    index={index}
                  />
                ))}
              </motion.div>
            </>
          )}

          {orphanItems.length > 0 && (
            <>
              <h2 className="stock-redesign__section-label stock-redesign__section-label--seguro">
                Sem Tratamento Ativo ({orphanItems.length})
              </h2>
              <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
                {orphanItems.map((item, index) => (
                  <StockCardRedesign
                    key={item.medicine.id}
                    item={item}
                    isComplex={false}
                    onAddStock={() => handleOpenModal(item.medicine.id)}
                    index={index}
                  />
                ))}
              </motion.div>
            </>
          )}
        </motion.div>
      )}

      {/* ── Histórico de Compras (complex only) ── */}
      {/* Simple: informação de última compra + custo já está per-card em StockCardRedesign */}
      {/* Complex: Carlos precisa do histórico completo para auditoria e análise de preço */}
      {isComplex && allEntries.length > 0 && (
        <section className="stock-redesign__history-section">
          <h2 className="stock-redesign__section-title">Histórico de Compras</h2>
          <EntradaHistorico entries={allEntries} maxVisible={3} />
        </section>
      )}

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
