import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getNow, addDays, getTodayLocal, parseLocalDate, getSaoPauloTime, cloneDate, addMonths } from '@utils/dateUtils.js'
import './Calendar.css'

/**
 * Retorna cor de fundo para o dia baseado na adesão (heat map).
 * @param {{adherence: number, taken: number, expected: number}|undefined} data
 * @returns {string} Cor CSS ou 'transparent'
 */
function getDayColor(data) {
  if (!data) return 'transparent'
  if (data.expected === 0) return 'transparent'
  if (data.adherence === 100) return 'var(--color-success)'
  if (data.adherence > 0) return 'var(--color-warning)'
  return 'var(--color-error)'
}

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
 * @property {Object<string, {adherence: number, taken: number, expected: number}>} [adherenceData={}]
 *   Dados de adesão por dia (YYYY-MM-DD → dados). Quando presente, sobrescreve as cores dos dias.
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

  // Lazy loading effect - carrega dados do mes quando viewDate muda
  useEffect(() => {
    if (!enableLazyLoad || !onLoadMonth) return

    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    let isCancelled = false

    // Setar loading sincronamente evita race condition com microtasks
    // (rAF anterior causava: finally() rodava antes do rAF → stuck loading)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)

    onLoadMonth(year, month)
      .catch((err) => {
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
    }
  }, [viewDate, enableLazyLoad, onLoadMonth])

  // Navigation handlers
  const handlePreviousMonth = () => {
    setViewDate((prevDate) => {
      const newDate = cloneDate(prevDate)
      newDate.setMonth(newDate.getMonth() - 1)
      return newDate
    })
  }

  const handleNextMonth = () => {
    setViewDate((prevDate) => {
      const newDate = cloneDate(prevDate)
      newDate.setMonth(newDate.getMonth() + 1)
      return newDate
    })
  }

  // Month picker handler
  const handleMonthSelect = (e) => {
    const [selectedYear, selectedMonth] = e.target.value.split('-').map(Number)
    const newDate = parseLocalDate(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)
    setViewDate(newDate)
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
      'Janeiro',
      'Fevereiro',
      'Marco',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ]

    const options = []
    const todayNow = getSaoPauloTime()
    
    // Calcular data inicial baseada no range (setando dia 1 via addMonths para evitar overflow de meses curtos)
    const startDate = addMonths(todayNow, monthPickerRange.start)

    // Calcular data final baseada no range
    const endDate = addMonths(todayNow, monthPickerRange.end)

    let current = cloneDate(startDate)
    while (current <= endDate) {
      options.push({
        value: `${current.getFullYear()}-${current.getMonth()}`,
        label: `${monthNamesLocal[current.getMonth()]} ${current.getFullYear()}`,
      })
      current = cloneDate(current)
      current.setMonth(current.getMonth() + 1)
    }

    return options.reverse()
  }

  // Calendar calculations
  // Calendar calculations - Usando parseLocalDate para garantir integridade do grid
  const daysInMonth = (y, m) => {
    const d = parseLocalDate(`${y}-${String(m + 2).padStart(2, '0')}-01`)
    d.setDate(0)
    return d.getDate()
  }
  const firstDayOfMonth = (y, m) => parseLocalDate(`${y}-${String(m + 1).padStart(2, '0')}-01`).getDay()

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Marco',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  // Build calendar days
  const days = []
  const totalDays = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)

  // Preencher dias vazios no inicio
  for (let i = 0; i < firstDay; i++) {
    days.push(
      <div key={`empty-${i}`} className="calendar-day empty" role="gridcell" aria-hidden="true" />
    )
  }

  const todayKey = getTodayLocal() // 'YYYY-MM-DD' em fuso Brasilia (R-020)

  // Preencher dias do mes
  for (let d = 1; d <= totalDays; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayDate = parseLocalDate(dateKey)

    const isToday = dateKey === todayKey
    const isSelected =
      selectedDate &&
      (typeof selectedDate === 'string'
        ? dateKey === selectedDate
        : dayDate.getFullYear() === selectedDate.getFullYear() &&
          dayDate.getMonth() === selectedDate.getMonth() &&
          dayDate.getDate() === selectedDate.getDate())

    // Verificar se ha doses registradas neste dia
    // CORRECAO: Usar parsing manual de YYYY-MM-DD para evitar bugs de timezone (R-020)
    // As datas em markedDates estao em formato YYYY-MM-DD (local Brasilia GMT-3)
    const hasLog = markedDates.some((dateStr) => dateStr === dateKey)

    // Heat map de adesão: aplica cor quando adherenceData tem dados para o dia
    const adherenceDayData = adherenceData[dateKey]
    const heatColor = getDayColor(adherenceDayData)
    const hasHeatColor = heatColor !== 'transparent'
    const ariaLabelParts = [
      `${d} de ${monthNames[month]} de ${year}`,
      isToday ? 'Hoje' : null,
      isSelected ? 'Selecionado' : null,
      hasHeatColor
        ? `Adesão ${adherenceDayData?.adherence ?? 0} por cento, ${adherenceDayData?.taken ?? 0} de ${adherenceDayData?.expected ?? 0} doses`
        : hasLog
          ? 'Com registro de dose'
          : 'Sem registros',
    ].filter(Boolean)

    days.push(
      <div
        key={d}
        className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasLog ? 'has-log' : ''} ${hasHeatColor ? 'has-adherence' : ''}`}
        style={hasHeatColor ? { '--heat-color': heatColor } : undefined}
        role="gridcell"
        aria-selected={isSelected}
        aria-label={ariaLabelParts.join('. ')}
        onClick={() => onDayClick && onDayClick(dayDate)}
      >
        <span className="day-number">{d}</span>
        {hasLog && !hasHeatColor && <div className="log-dot"></div>}
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
            className="calendar-nav-btn"
            aria-label="Mês anterior"
            type="button"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <select
            className="month-picker"
            value={`${year}-${month}`}
            onChange={handleMonthSelect}
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
            onClick={handleNextMonth}
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

    // Controles simples (default)
    return (
      <div className="calendar-controls">
        <button
          onClick={handlePreviousMonth}
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
          onClick={handleNextMonth}
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
    <div className="calendar-widget">
      {renderControls()}
      <div className="calendar-weekdays" aria-hidden="true">
        <div>Dom</div>
        <div>Seg</div>
        <div>Ter</div>
        <div>Qua</div>
        <div>Qui</div>
        <div>Sex</div>
        <div>Sab</div>
      </div>
      <div
        className="calendar-grid"
        role="grid"
        aria-label={`Calendário de ${monthNames[month]} de ${year}`}
        onTouchStart={enableSwipe ? handleTouchStart : undefined}
        onTouchMove={enableSwipe ? handleTouchMove : undefined}
        onTouchEnd={enableSwipe ? handleTouchEnd : undefined}
      >
        {isLoading && enableLazyLoad ? (
          <div className="calendar-skeleton">
            {Array(35)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="skeleton-day"></div>
              ))}
          </div>
        ) : (
          (() => {
            const rows = []
            for (let i = 0; i < days.length; i += 7) {
              rows.push(
                <div key={`row-${i / 7}`} className="calendar-grid-row" role="row">
                  {days.slice(i, i + 7)}
                </div>
              )
            }
            return rows
          })()
        )}
      </div>
    </div>
  )
}
