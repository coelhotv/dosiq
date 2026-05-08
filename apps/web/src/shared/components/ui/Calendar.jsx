import { useState, useEffect } from 'react'
import { getTodayLocal, parseLocalDate, getSaoPauloTime, cloneDate, addMonths, formatLocalDate } from '@utils/dateUtils.js'
import CalendarControls from './CalendarControls'
import CalendarGrid, { buildCalendarDays } from './CalendarGrid'
import './Calendar.css'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const daysInMonth = (y, m) => {
  const d = parseLocalDate(`${y}-${String(m + 2).padStart(2, '0')}-01`)
  d.setDate(0)
  return d.getDate()
}
const firstDayOfMonth = (y, m) =>
  parseLocalDate(`${y}-${String(m + 1).padStart(2, '0')}-01`).getDay()

function generateMonthOptions(enableMonthPicker, monthPickerRange) {
  if (!enableMonthPicker) return []
  const options = []
  const todayNow = getSaoPauloTime()
  const startDate = addMonths(todayNow, monthPickerRange.start)
  const endDate = addMonths(todayNow, monthPickerRange.end)
  let current = cloneDate(startDate)
  while (current <= endDate) {
    options.push({
      value: `${current.getFullYear()}-${current.getMonth()}`,
      label: `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear()}`,
    })
    current = cloneDate(current)
    current.setMonth(current.getMonth() + 1)
  }
  return options.reverse()
}

/**
 * Calendar - Componente de calendario reutilizavel com features opcionais
 */
export default function Calendar({
  markedDates = [],
  selectedDate,
  onDayClick,
  enableLazyLoad = false,
  onLoadMonth,
  enableSwipe = false,
  enableMonthPicker = false,
  monthPickerRange = { start: -12, end: 3 },
  adherenceData = {},
}) {
  const [viewDate, setViewDate] = useState(getSaoPauloTime())
  const [isLoading, setIsLoading] = useState(false)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)

  useEffect(() => {
    if (!enableLazyLoad || !onLoadMonth) return
    let isCancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    onLoadMonth(viewDate.getFullYear(), viewDate.getMonth())
      .catch((err) => { if (!isCancelled) console.error('Error in onLoadMonth:', err) })
      .finally(() => { if (!isCancelled) setIsLoading(false) })
    return () => { isCancelled = true }
  }, [viewDate, enableLazyLoad, onLoadMonth])

  const handlePreviousMonth = () => setViewDate((d) => { const n = cloneDate(d); n.setMonth(n.getMonth() - 1); return n })
  const handleNextMonth = () => setViewDate((d) => { const n = cloneDate(d); n.setMonth(n.getMonth() + 1); return n })

  const handleMonthSelect = (e) => {
    const [y, m] = e.target.value.split('-').map(Number)
    setViewDate(parseLocalDate(`${y}-${String(m + 1).padStart(2, '0')}-01`))
  }

  const handleTouchStart = (e) => { if (!enableSwipe) return; setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX) }
  const handleTouchMove = (e) => { if (!enableSwipe) return; setTouchEnd(e.targetTouches[0].clientX) }
  const handleTouchEnd = () => {
    if (!enableSwipe || !touchStart || !touchEnd || isLoading) return
    const dist = touchStart - touchEnd
    if (dist > 50) handleNextMonth()
    else if (dist < -50) handlePreviousMonth()
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const todayKey = getTodayLocal()
  const monthOptions = generateMonthOptions(enableMonthPicker, monthPickerRange)

  const days = buildCalendarDays({
    year, month, monthNames: MONTH_NAMES, todayKey, selectedDate, markedDates,
    adherenceData, daysInMonth, firstDayOfMonth, parseLocalDate, formatLocalDate, onDayClick,
  })

  return (
    <div className="calendar-widget">
      <CalendarControls
        enableMonthPicker={enableMonthPicker}
        year={year}
        month={month}
        monthNames={MONTH_NAMES}
        isLoading={isLoading}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onMonthSelect={handleMonthSelect}
        generateMonthOptions={() => monthOptions}
      />
      <div className="calendar-weekdays" aria-hidden="true">
        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div>
        <div>Qui</div><div>Sex</div><div>Sab</div>
      </div>
      <div
        className="calendar-grid"
        role="grid"
        aria-label={`Calendário de ${MONTH_NAMES[month]} de ${year}`}
        onTouchStart={enableSwipe ? handleTouchStart : undefined}
        onTouchMove={enableSwipe ? handleTouchMove : undefined}
        onTouchEnd={enableSwipe ? handleTouchEnd : undefined}
      >
        <CalendarGrid days={days} isLoading={isLoading} enableLazyLoad={enableLazyLoad} monthNames={MONTH_NAMES} month={month} year={year} />
      </div>
    </div>
  )
}
