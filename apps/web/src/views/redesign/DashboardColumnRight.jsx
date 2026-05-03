import CronogramaPeriodo from '@dashboard/components/CronogramaPeriodo'
import StockAlertInline from '@dashboard/components/StockAlertInline'
import DashboardEmptyState from './DashboardEmptyState'

export default function DashboardColumnRight({
  scheduleAllDoses,
  today,
  handleRegisterDoseQuick,
  complexityMode,
  now,
  contextLoading,
  onNavigate,
  criticalStockItems
}) {
  return (
    <div className="dashboard-column-right">
      {/* Cronograma do Dia */}
      {scheduleAllDoses.length > 0 && (
        <section aria-label="Cronograma de hoje">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">
              Cronograma de Hoje
            </h2>
            <p className="dashboard-section-subtitle">
              {today}
            </p>
          </div>
          <CronogramaPeriodo
            allDoses={scheduleAllDoses}
            onRegister={(dose) =>
              handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake)
            }
            variant={complexityMode === 'simple' ? 'simple' : 'complex'}
            now={now}
          />
        </section>
      )}

      {/* Empty State */}
      {scheduleAllDoses.length === 0 && !contextLoading && (
        <DashboardEmptyState onNavigate={onNavigate} />
      )}

      {/* Stock Alert (Simple Mode: Bottom) */}
      {complexityMode !== 'complex' && criticalStockItems.length > 0 && (
        <section className="dashboard-footer-section" aria-label="Alertas de estoque">
          <StockAlertInline
            criticalItems={criticalStockItems}
            onNavigateToStock={() => onNavigate?.('stock')}
          />
        </section>
      )}
    </div>
  )
}
