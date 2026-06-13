/**
 * StockPill — Indicador de estoque (crítico/baixo/normal/alto) com dias restantes
 * Ícones de calendário transmitem narrativa temporal: agendado → atenção → urgente
 */
import { CalendarArrowUp, CalendarCheck2, CalendarSync, CalendarX2 } from 'lucide-react'

const STATUS_CONFIG = {
  critical: { color: '#ef4444', bg: '#fef2f2', Icon: CalendarX2 },
  low: { color: '#f59e0b', bg: '#fffbeb', Icon: CalendarSync },
  normal: { color: '#22c55e', bg: '#f0fdf4', Icon: CalendarCheck2 },
  high: { color: '#3b82f6', bg: '#eff6ff', Icon: CalendarArrowUp },
}

/**
 * 012 B4 / ADR-067: número exibido = doses físicas (dose-primário) p/ freq ≠ diário;
 * diário mantém "N dias" (sem regressão). A COR sempre mede runway (status).
 * Rótulo sempre "dose(s)" — cobre injetável também (plural simples).
 */
function buildLabel({ daysRemaining, dosesRemaining, isDailyStock }) {
  if (!isDailyStock && Number.isFinite(dosesRemaining)) {
    return `${dosesRemaining} ${dosesRemaining === 1 ? 'dose' : 'doses'}`
  }
  return isFinite(daysRemaining) ? `${daysRemaining} dias` : '∞'
}

export default function StockPill({ status, daysRemaining, dosesRemaining, isDailyStock = true }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.normal
  const { Icon } = cfg
  const label = buildLabel({ daysRemaining, dosesRemaining, isDailyStock })

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
