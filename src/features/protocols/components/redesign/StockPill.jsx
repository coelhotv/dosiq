/**
 * StockPill — Indicador de estoque (crítico/baixo/normal/alto) com dias restantes
 * Exibe: emoji dot colorido + label "X dias"
 */
const STATUS_CONFIG = {
  critical: { color: '#ef4444', bg: '#fef2f2', dot: '🔴', label: 'Crítico' },
  low: { color: '#f59e0b', bg: '#fffbeb', dot: '🟡', label: 'Baixo' },
  normal: { color: '#22c55e', bg: '#f0fdf4', dot: '🟢', label: 'OK' },
  high: { color: '#3b82f6', bg: '#eff6ff', dot: '🔵', label: 'OK' },
}

export default function StockPill({ status, daysRemaining }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.normal
  const label = isFinite(daysRemaining) ? `${daysRemaining} dias` : '∞'

  return (
    <span
      className="stock-pill"
      style={{ color: cfg.color, background: cfg.bg }}
      title={`Estoque: ${label}`}
    >
      {cfg.dot} {label}
    </span>
  )
}
