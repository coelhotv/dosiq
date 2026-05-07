/**
 * StockInventory — Seções de conteúdo do estoque (bifurcação Simple/Complex).
 */
import { useMotion } from '@shared/hooks/useMotion'
import CriticalAlertBanner from '@stock/components/redesign/CriticalAlertBanner'
import EntradaHistorico from '@stock/components/redesign/EntradaHistorico'
import CostSummaryRedesign from '@stock/components/CostSummaryRedesign'
import PrescriptionTimelineRedesign from '@stock/components/PrescriptionTimelineRedesign'
import StockInventoryGrid from './StockInventoryGrid'
import StockCategorizedSections from './StockCategorizedSections'

export default function StockInventory({
  isComplex,
  criticalItems,
  warningItems,
  okItems,
  highItems,
  orphanItems,
  sortedAllItems,
  allPurchases,
  costData,
  prescriptionTimelineData,
  handleOpenModal,
}) {
  const motionConfig = useMotion()

  return (
    <>
      <CriticalAlertBanner criticalCount={criticalItems.length} onBuyAll={() => handleOpenModal()} />

      {isComplex ? (
        <StockInventoryGrid items={sortedAllItems} onAddStock={handleOpenModal} motionConfig={motionConfig} />
      ) : (
        <StockCategorizedSections
          criticalItems={criticalItems}
          warningItems={warningItems}
          okItems={[...okItems.filter(i => i.hasActiveProtocol), ...highItems.filter(i => i.hasActiveProtocol)]}
          orphanItems={orphanItems}
          onAddStock={handleOpenModal}
          motionConfig={motionConfig}
        />
      )}

      {isComplex && allPurchases.length > 0 && (
        <section className="stock-redesign__history-section">
          <h2 className="stock-redesign__section-title">Histórico de Compras</h2>
          <EntradaHistorico purchases={allPurchases} maxVisible={3} />
        </section>
      )}

      {costData && costData.items?.length > 0 && (
        <section className="mt-6" aria-label="Custo mensal dos medicamentos">
          <CostSummaryRedesign costData={costData} isComplex={isComplex} />
        </section>
      )}

      {prescriptionTimelineData.length > 0 && (
        <section className="mt-4" aria-label="Vigência das prescrições">
          <PrescriptionTimelineRedesign prescriptions={prescriptionTimelineData} isComplex={isComplex} />
        </section>
      )}
    </>
  )
}
