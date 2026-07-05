/**
 * CalendarGrid — Grade de dias do Calendar.
 */


/**
 * Renderiza as linhas do calendário agrupadas por semana.
 */
export default function CalendarGrid({
  days,
  isLoading,
  enableLazyLoad,
}: {
  days: any[]
  isLoading: boolean
  enableLazyLoad?: boolean
}) {
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
