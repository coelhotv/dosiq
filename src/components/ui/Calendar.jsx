import { useState, useEffect } from 'react'
import './Calendar.css'

/**
 * Calendar - Componente de calendario reutilizavel com features opcionais
 * 
 * @typedef {Object} CalendarProps
 * @property {Array<string>} [markedDates=[]] - Datas com marcacao
 * @property {Date} [selectedDate] - Data selecionada
 * @property {Function} [onDayClick] - Callback ao clicar em dia
 * @property {boolean} [enableLazyLoad=false] - Habilitar lazy loading de meses
 * @property {Function} [onLoadMonth] - Callback para carregar dados do mes
 * @property {boolean} [enableSwipe=false] - Habilitar navegacao por swipe
 * @property {boolean} [enableMonthPicker=false] - Habilitar seletor de mes
 * @property {Object} [monthPickerRange] - Range do seletor {start, end} em meses
 */
export default function Calendar({
  markedDates = [],
  selectedDate,
  onDayClick,
  enableLazyLoad = false,
  onLoadMonth,
  enableSwipe = false,
  enableMonthPicker = false,
  monthPickerRange = { start: -12, end: 3 }
}) {
  const [viewDate, setViewDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)

  // Lazy loading effect - carrega dados do mes quando viewDate muda
  useEffect(() => {
    if (!enableLazyLoad || !onLoadMonth) return

    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    let isCancelled = false
    
    // Usar requestAnimationFrame para evitar setState sincrono no effect
    const frameId = requestAnimationFrame(() => {
      setIsLoading(true)
    })
    
    onLoadMonth(year, month)
      .catch(err => {
        if (!isCancelled) {
          console.error('Error in onLoadMonth:', err)
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [viewDate, enableLazyLoad, onLoadMonth])

  // Navigation handlers
  const handlePreviousMonth = () => {
    setViewDate(prevDate => {
      const newDate = new Date(prevDate)
      newDate.setMonth(newDate.getMonth() - 1)
      return newDate
    })
  }

  const handleNextMonth = () => {
    setViewDate(prevDate => {
      const newDate = new Date(prevDate)
      newDate.setMonth(newDate.getMonth() + 1)
      return newDate
    })
  }

  // Month picker handler
  const handleMonthSelect = (e) => {
    const [selectedYear, selectedMonth] = e.target.value.split('-').map(Number)
    setViewDate(new Date(selectedYear, selectedMonth, 1))
  }

  // Touch handlers (apenas se enableSwipe)
  const handleTouchStart = (e) => {
    if (!enableSwipe) return
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e) => {
    if (!enableSwipe) return
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!enableSwipe || !touchStart || !touchEnd || isLoading) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe) {
      handleNextMonth()
    } else if (isRightSwipe) {
      handlePreviousMonth()
    }
  }

  // Generate month options for picker - defined inline para evitar issues de memoization
  const generateMonthOptions = () => {
    if (!enableMonthPicker) return []

    const monthNamesLocal = [
      'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    
    const options = []
    const today = new Date()
    const startDate = new Date(today.getFullYear(), today.getMonth() + monthPickerRange.start, 1)
    const endDate = new Date(today.getFullYear(), today.getMonth() + monthPickerRange.end, 1)

    let current = startDate
    while (current <= endDate) {
      options.push({
        value: `${current.getFullYear()}-${current.getMonth()}`,
        label: `${monthNamesLocal[current.getMonth()]} ${current.getFullYear()}`
      })
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }

    return options.reverse()
  }

  // Calendar calculations
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  // Build calendar days
  const days = []
  const totalDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)

  // Preencher dias vazios no inicio
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Preencher dias do mes
  for (let d = 1; d <= totalDays; d++) {
    const dayDate = new Date(year, month, d)
    dayDate.setHours(0, 0, 0, 0)

    const isToday = dayDate.getTime() === today.getTime()
    const isSelected = selectedDate &&
      dayDate.getFullYear() === selectedDate.getFullYear() &&
      dayDate.getMonth() === selectedDate.getMonth() &&
      dayDate.getDate() === selectedDate.getDate()

    // Verificar se ha doses registradas neste dia
    const hasLog = markedDates.some(dateStr => {
      const dLog = new Date(dateStr)
      // Use UTC comparison para evitar problemas de timezone
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

  // Render controls baseado nas features
  const renderControls = () => {
    if (enableMonthPicker) {
      return (
        <div className="calendar-controls">
          <button 
            onClick={handlePreviousMonth} 
            disabled={isLoading} 
            aria-label="Mes anterior"
          >
            {'<'}
          </button>
          <select
            className="month-picker"
            value={`${year}-${month}`}
            onChange={handleMonthSelect}
            disabled={isLoading}
            aria-label="Selecionar mes"
          >
            {generateMonthOptions().map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button 
            onClick={handleNextMonth} 
            disabled={isLoading} 
            aria-label="Proximo mes"
          >
            {'>'}
          </button>
        </div>
      )
    }

    // Controles simples (default)
    return (
      <div className="calendar-controls">
        <button 
          onClick={handlePreviousMonth} 
          disabled={isLoading}
          aria-label="Mes anterior"
        >
          {'<'}
        </button>
        <div className="current-month">
          {monthNames[month]} {year}
        </div>
        <button 
          onClick={handleNextMonth} 
          disabled={isLoading}
          aria-label="Proximo mes"
        >
          {'>'}
        </button>
      </div>
    )
  }

  return (
    <div className="calendar-widget">
      {renderControls()}
      <div className="calendar-weekdays">
        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sab</div>
      </div>
      <div
        className="calendar-grid"
        onTouchStart={enableSwipe ? handleTouchStart : undefined}
        onTouchMove={enableSwipe ? handleTouchMove : undefined}
        onTouchEnd={enableSwipe ? handleTouchEnd : undefined}
      >
        {isLoading && enableLazyLoad ? (
          <div className="calendar-skeleton">
            {Array(35).fill(0).map((_, i) => (
              <div key={i} className="skeleton-day"></div>
            ))}
          </div>
        ) : (
          days
        )}
      </div>
    </div>
  )
}
