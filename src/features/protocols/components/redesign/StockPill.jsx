/**
 * StockPill — Indicador de estoque (crítico/baixo/normal/alto) com dias restantes
 * Ícones de calendário transmitem narrativa temporal: agendado → atenção → urgente
 */
import { CalendarArrowUp, CalendarCheck2, CalendarSync, CalendarX2 } from 'lucide-react'

const STATUS_CONFIG = {
  critical: { color: '#ef4444', bg: '#fef2f2', Icon: CalendarX2 },
  low:      { color: '#f59e0b', bg: '#fffbeb', Icon: CalendarSync },
  normal:   { color: '#22c55e', bg: '#f0fdf4', Icon: CalendarCheck2 },
  high:     { color: '#3b82f6', bg: '#eff6ff', Icon: CalendarArrowUp },
}

export default function StockPill({ status, daysRemaining }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.normal
  const { Icon } = cfg
  const label = isFinite(daysRemaining) ? `${daysRemaining} dias` : '∞'

  return (
    <span
      className="stock-pill"
      style={{ color: cfg.color, background: cfg.bg }}
      title={`Estoque: ${label}`}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </span>
  )
}
