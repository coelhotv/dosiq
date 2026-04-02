/**
 * TreatmentPlanHeader — Header colorido de grupo (apenas modo complexo)
 * S7.5.5: Adicionar botão de editar plano com ícone PencilLine
 * Exibe: dot + emoji + nome + count + alert + chevron + [edit btn se for plano real]
 */
import { PencilLine, Trash2 } from 'lucide-react'

export default function TreatmentPlanHeader({ group, isCollapsed, onToggle, onEditPlan, onDeletePlan }) {
  // S7.5.5: Detectar se é plano real (não fallback de classe terapêutica)
  const isPlan = group.isPlan ?? group.groupKey?.startsWith('plan:')

  return (
    <div className="plan-header-wrap">
      <button
        className="plan-header"
        onClick={onToggle}
        style={{ '--plan-color': group.groupColor }}
      >
        <span className="plan-header__dot" style={{ background: group.groupColor }} />
        <span className="plan-header__emoji">{group.groupEmoji}</span>
        <span className="plan-header__label">{group.groupLabel}</span>
        <span className="plan-header__count">{group.items.length}×</span>
        {group.hasAlert && <span className="plan-header__alert">⚠</span>}
        <span className="plan-header__chevron">{isCollapsed ? '▼' : '▲'}</span>
      </button>

      {isPlan && onEditPlan && (
        <button
          className="plan-header__edit-btn"
          onClick={(e) => {
            e.stopPropagation()
            onEditPlan(group)
          }}
          aria-label={`Editar plano ${group.groupLabel}`}
          title="Editar plano de tratamento"
        >
          <PencilLine size={15} />
        </button>
      )}
      {isPlan && onDeletePlan && (
        <button
          className="plan-header__delete-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDeletePlan(group)
          }}
          aria-label={`Excluir plano ${group.groupLabel}`}
          title="Excluir plano de tratamento"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}
