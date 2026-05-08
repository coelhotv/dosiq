/**
 * ProtocolsTreatmentPlans — Seção de planos de tratamento da view Protocols.
 */
import Button from '@shared/components/ui/Button'
import Card from '@shared/components/ui/Card'

export default function ProtocolsTreatmentPlans({ treatmentPlans, onEditPlan, onDeletePlan }) {
  if (treatmentPlans.length === 0) return null

  return (
    <div className="treatment-plans-section">
      <h3 className="section-title plans">📁 Planos de Tratamento</h3>
      <div className="plans-grid">
        {treatmentPlans.map((plan) => (
          <Card key={plan.id} className="treatment-plan-card">
            <div className="plan-header">
              <div>
                <h4>{plan.name}</h4>
                <p className="plan-objective">{plan.objective}</p>
              </div>
              <div className="plan-actions">
                <Button variant="ghost" size="sm" onClick={() => onEditPlan(plan)}>
                  ✏️
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDeletePlan(plan)}>
                  🗑️
                </Button>
              </div>
            </div>
            {plan.description && <p className="plan-desc">{plan.description}</p>}

            <div className="plan-protocols-list">
              {plan.protocols && plan.protocols.length > 0 ? (
                plan.protocols.map((p) => (
                  <div key={p.id} className="plan-protocol-row">
                    <span>💊 {p.name}</span>
                    <span className={`titration-status-mini ${p.titration_status}`}>
                      {p.titration_status === 'titulando' ? '📈 Titulando' : '✅'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="empty-plan">Nenhum remédio vinculado ainda.</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
