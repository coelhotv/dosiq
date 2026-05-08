/**
 * CalendarControls — Controles de navegação do Calendar (simples e com picker).
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function CalendarControls({
  enableMonthPicker,
  year,
  month,
  monthNames,
  isLoading,
  onPreviousMonth,
  onNextMonth,
  onMonthSelect,
  generateMonthOptions,
}) {
  if (enableMonthPicker) {
    return (
      <div className="calendar-controls">
        <button
          onClick={onPreviousMonth}
          disabled={isLoading}
          className="calendar-nav-btn"
          aria-label="Mês anterior"
          type="button"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <select
          className="month-picker"
          value={`${year}-${month}`}
          onChange={onMonthSelect}
          disabled={isLoading}
          aria-label="Selecionar mes"
        >
          {generateMonthOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={onNextMonth}
          disabled={isLoading}
          className="calendar-nav-btn"
          aria-label="Próximo mês"
          type="button"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="calendar-controls">
      <button
        onClick={onPreviousMonth}
        disabled={isLoading}
        className="calendar-nav-btn"
        aria-label="Mês anterior"
        type="button"
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <div className="current-month">
        {monthNames[month]} {year}
      </div>
      <button
        onClick={onNextMonth}
        disabled={isLoading}
        className="calendar-nav-btn"
        aria-label="Próximo mês"
        type="button"
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
