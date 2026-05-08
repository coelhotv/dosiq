/**
 * CalendarGrid — Grade de dias do Calendar.
 */

/**
 * Retorna cor de fundo para o dia baseado na adesão (heat map).
 */
function getDayColor(data) {
  if (!data) return 'transparent'
  if (data.expected === 0) return 'transparent'
  if (data.adherence === 100) return 'var(--color-success)'
  if (data.adherence > 0) return 'var(--color-warning)'
  return 'var(--color-error)'
}

/**
 * Verifica se uma data está selecionada.
 */
function isDaySelected(dayDate, dateKey, selectedDate) {
  if (!selectedDate) return false
  if (typeof selectedDate === 'string') return dateKey === selectedDate
  return (
    dayDate.getFullYear() === selectedDate.getFullYear() &&
    dayDate.getMonth() === selectedDate.getMonth() &&
    dayDate.getDate() === selectedDate.getDate()
  )
}

/**
 * Constrói o aria-label para um dia do calendário.
 */
function buildDayAriaLabel({ d, month, year, monthNames, isToday, isSelected, hasHeatColor, adherenceDayData, hasLog }) {
  const parts = [`${d} de ${monthNames[month]} de ${year}`]
  if (isToday) parts.push('Hoje')
  if (isSelected) parts.push('Selecionado')
  if (hasHeatColor) {
    parts.push(`Adesão ${adherenceDayData?.adherence ?? 0} por cento, ${adherenceDayData?.taken ?? 0} de ${adherenceDayData?.expected ?? 0} doses`)
  } else if (hasLog) {
    parts.push('Com registro de dose')
  } else {
    parts.push('Sem registros')
  }
  return parts.join('. ')
}

/**
 * Constrói o array de dias (botões + vazios) para o mês exibido.
 */
export function buildCalendarDays({
  year,
  month,
  monthNames,
  todayKey,
  selectedDate,
  markedDates,
  adherenceData,
  daysInMonth,
  firstDayOfMonth,
  parseLocalDate,
  onDayClick,
}) {
  const days = []
  const totalDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)

  for (let i = 0; i < firstDay; i++) {
    days.push(
      <div key={`empty-${i}`} className="calendar-day empty" role="gridcell" aria-hidden="true" />
    )
  }

  for (let d = 1; d <= totalDays; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayDate = parseLocalDate(dateKey)

    const isToday = dateKey === todayKey
    const isSelected = isDaySelected(dayDate, dateKey, selectedDate)
    const hasLog = markedDates.some((dateStr) => dateStr === dateKey)
    const adherenceDayData = adherenceData[dateKey]
    const heatColor = getDayColor(adherenceDayData)
    const hasHeatColor = heatColor !== 'transparent'
    const ariaLabel = buildDayAriaLabel({ d, month, year, monthNames, isToday, isSelected, hasHeatColor, adherenceDayData, hasLog })

    days.push(
      <button
        key={d}
        type="button"
        className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasLog ? 'has-log' : ''} ${hasHeatColor ? 'has-adherence' : ''}`}
        style={hasHeatColor ? { '--heat-color': heatColor } : undefined}
        role="gridcell"
        aria-selected={isSelected}
        aria-label={ariaLabel}
        onClick={() => onDayClick && onDayClick(dayDate)}
      >
        <span className="day-number">{d}</span>
        {hasLog && !hasHeatColor && <div className="log-dot"></div>}
      </button>
    )
  }

  return days
}

/**
 * Renderiza as linhas do calendário agrupadas por semana.
 */
export default function CalendarGrid({ days, isLoading, enableLazyLoad, monthNames, month, year }) {
  if (isLoading && enableLazyLoad) {
    return (
      <div className="calendar-skeleton">
        {Array(35)
          .fill(0)
          .map((_, i) => (
            <div key={i} className="skeleton-day"></div>
          ))}
      </div>
    )
  }

  const rows = []
  for (let i = 0; i < days.length; i += 7) {
    rows.push(
      <div key={`row-${i / 7}`} className="calendar-grid-row" role="row">
        {days.slice(i, i + 7)}
      </div>
    )
  }
  return <>{rows}</>
}
