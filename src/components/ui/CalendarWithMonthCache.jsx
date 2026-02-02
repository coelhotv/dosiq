import { useState, useEffect, useCallback } from 'react'
import './Calendar.css'

/**
 * CalendarWithMonthCache - Reusable calendar with month-based lazy loading
 * Now: no internal month caching; calls onLoadMonth on every month change.
 */
export default function CalendarWithMonthCache({
  onLoadMonth,
  markedDates = [],
  selectedDate,
  onDayClick
}) {
  const [viewDate, setViewDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)



  // Load a specific month via parent callback (always call)
  const loadMonth = useCallback(async (year, month) => {
    try {
      setIsLoading(true)
      const result = await onLoadMonth(year, month)
      return result
    } catch (err) {
      console.error('Error in onLoadMonth:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [onLoadMonth])

  // When viewDate changes, always fetch that month's data
  useEffect(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    loadMonth(year, month)
  }, [viewDate, loadMonth])

  // Handle month navigation
  const handlePreviousMonth = useCallback(() => {
    const newDate = new Date(viewDate)
    newDate.setMonth(newDate.getMonth() - 1)
    setViewDate(newDate)
  }, [viewDate])

  const handleNextMonth = useCallback(() => {
    const newDate = new Date(viewDate)
    newDate.setMonth(newDate.getMonth() + 1)
    setViewDate(newDate)
  }, [viewDate])

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const days = []
  const totalDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)

  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let d = 1; d <= totalDays; d++) {
    const dayDate = new Date(year, month, d)
    dayDate.setHours(0, 0, 0, 0)
    
    const isToday = dayDate.getTime() === today.getTime()
    const isSelected = selectedDate && 
                      dayDate.getFullYear() === selectedDate.getFullYear() && 
                      dayDate.getMonth() === selectedDate.getMonth() && 
                      dayDate.getDate() === selectedDate.getDate()
    
    const hasLog = markedDates.some(dateStr => {
      const dLog = new Date(dateStr)
      // Use UTC comparison to avoid timezone mismatches
      return dLog.getUTCFullYear() === dayDate.getFullYear() &&
             dLog.getUTCMonth() === dayDate.getMonth() &&
             dLog.getUTCDate() === dayDate.getDate()
    })

    days.push(
      <div 
        key={d} 
        className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasLog ? 'has-log' : ''}`}
        onClick={() => onDayClick && onDayClick(dayDate)}
      >
        <span className="day-number">{d}</span>
        {hasLog && <div className="log-dot"></div>}
      </div>
    )
  }

  return (
    <div className="calendar-widget">
      <div className="calendar-controls">
        <button onClick={handlePreviousMonth} disabled={isLoading}>&lt;</button>
        <div className="current-month">
          {monthNames[month]} {year}
        </div>
        <button onClick={handleNextMonth} disabled={isLoading}>&gt;</button>
      </div>
      <div className="calendar-weekdays">
        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
      </div>
      <div className="calendar-grid">
        {days}
      </div>
    </div>
  )
}
