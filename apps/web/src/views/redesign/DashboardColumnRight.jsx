import CronogramaPeriodo from '@dashboard/components/CronogramaPeriodo'
import CronogramaDoseItem from '@dashboard/components/CronogramaDoseItem'
import StockAlertInline from '@dashboard/components/StockAlertInline'
import DashboardEmptyState from './DashboardEmptyState'

export default function DashboardColumnRight({
  scheduleAllDoses,
  carryOverDoses = [],
  lookAheadDoses = [],
  today,
  handleRegisterDoseQuick,
  complexityMode,
  now,
  nowRaw,
  contextLoading,
  onNavigate,
  criticalStockItems
}) {
  const onRegister = (dose) =>
    handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake, dose.instanceId)
  return (
    <div className="dashboard-column-right">
      {/* Pendências de ontem (carry-over cross-dia, F4.3e) — doses de ontem ainda
          pendentes dentro da tolerância. Seção própria no topo, antes do cronograma
          de hoje; não é slot de hoje (preserva o fix do slot-fantasma). */}
      {carryOverDoses.length > 0 && (
        <section className="dashboard-carryover-section" aria-label="Pendências de ontem">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Pendências de ontem</h2>
            <p className="dashboard-section-subtitle">Doses de ontem ainda no prazo de registro</p>
          </div>
          <div className="cronograma-doses cronograma-doses--simple">
            {carryOverDoses.map((dose) => (
              <CronogramaDoseItem
                key={`carry-${dose.instanceId}`}
                dose={dose}
                onRegister={onRegister}
                stockDays={dose.stockDays}
                stockStatus={dose.stockStatus}
                now={nowRaw ?? now}
              />
            ))}
          </div>
        </section>
      )}

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
              handleRegisterDoseQuick(
                dose.medicineId,
                dose.protocolId,
                dose.dosagePerIntake,
                dose.instanceId
              )
            }
            variant={complexityMode === 'simple' ? 'simple' : 'complex'}
            now={now}
            nowRaw={nowRaw}
          />
        </section>
      )}

      {/* Empty State */}
      {scheduleAllDoses.length === 0 && !contextLoading && (
        <DashboardEmptyState onNavigate={onNavigate} />
      )}

      {/* Em breve (look-ahead cross-dia, F4.3e) — doses de amanhã já dentro da tolerância
          (aparece no fim do dia). Espelha "Pendências de ontem"; seção própria no rodapé. */}
      {lookAheadDoses.length > 0 && (
        <section className="dashboard-lookahead-section" aria-label="Em breve">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Em breve</h2>
            <p className="dashboard-section-subtitle">Próximas doses, já chegando</p>
          </div>
          <div className="cronograma-doses cronograma-doses--simple">
            {lookAheadDoses.map((dose) => (
              <CronogramaDoseItem
                key={`ahead-${dose.instanceId}`}
                dose={dose}
                onRegister={onRegister}
                stockDays={dose.stockDays}
                stockStatus={dose.stockStatus}
                now={nowRaw ?? now}
              />
            ))}
          </div>
        </section>
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
