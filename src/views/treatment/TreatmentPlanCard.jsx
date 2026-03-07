import { useState } from 'react'
import './Treatment.css'

export default function TreatmentPlanCard({ plan, onEdit, children }) {
  const [expanded, setExpanded] = useState(true)
  const activeCount = plan.activeProtocols?.length || 0

  return (
    <div className="treatment-plan-card">
      <button
        className="treatment-plan-card__header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="treatment-plan-card__title">
          <span className="treatment-plan-card__icon">{plan.emoji || '📁'}</span>
          <span className="treatment-plan-card__name">{plan.name}</span>
          <span className="treatment-plan-card__count">
            {activeCount} {activeCount === 1 ? 'med' : 'meds'}
          </span>
        </div>
        <span className={`treatment-plan-card__chevron ${expanded ? 'expanded' : ''}`}>›</span>
      </button>

      {expanded && (
        <div className="treatment-plan-card__body">
          {children}
          {onEdit && (
            <div className="treatment-plan-card__footer">
              <button className="treatment-plan-card__edit-btn" onClick={() => onEdit(plan)}>
                Editar plano
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
