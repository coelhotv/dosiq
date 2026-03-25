/**
 * TreatmentPlanHeader — Header colorido de grupo (apenas modo complexo)
 * Exibe: dot colorido + emoji + nome do grupo + count + alert indicator + chevron
 */
export default function TreatmentPlanHeader({ group, isCollapsed, onToggle }) {
  return (
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
  )
}
