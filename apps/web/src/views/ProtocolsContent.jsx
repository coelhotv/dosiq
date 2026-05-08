/**
 * ProtocolsContent — Conteúdo principal da view Protocols (lista de protocolos).
 */
import ProtocolCard from '@protocols/components/ProtocolCard'
import ProtocolsTreatmentPlans from './ProtocolsTreatmentPlans'

export default function ProtocolsContent({
  treatmentPlans,
  activeProtocols,
  inactiveProtocols,
  onEditPlan,
  onDeletePlan,
  onEdit,
  onToggleActive,
  onDelete,
}) {
  return (
    <div className="protocols-content">
      <ProtocolsTreatmentPlans
        treatmentPlans={treatmentPlans}
        onEditPlan={onEditPlan}
        onDeletePlan={onDeletePlan}
      />

      {activeProtocols.length > 0 && (
        <div className="protocols-section">
          <h3 className="section-title active">
            {treatmentPlans.length > 0
              ? '🔍 Todos os Protocolos Ativos'
              : '✅ Protocolos Ativos'}{' '}
            ({activeProtocols.length})
          </h3>
          <div className="protocols-grid">
            {activeProtocols.map((protocol) => (
              <ProtocolCard
                key={protocol.id}
                protocol={protocol}
                onEdit={onEdit}
                onToggleActive={onToggleActive}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {inactiveProtocols.length > 0 && (
        <div className="protocols-section">
          <h3 className="section-title inactive">
            ⏸️ Protocolos Pausados ({inactiveProtocols.length})
          </h3>
          <div className="protocols-grid">
            {inactiveProtocols.map((protocol) => (
              <ProtocolCard
                key={protocol.id}
                protocol={protocol}
                onEdit={onEdit}
                onToggleActive={onToggleActive}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
