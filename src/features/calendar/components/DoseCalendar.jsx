/**
 * DoseCalendar - Calendário visual de doses com indicadores de status
 *
 * Componente que exibe um calendário mensal com indicadores coloridos
 * mostrando o status de adesão para cada dia.
 *
 * @module DoseCalendar
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import Calendar from '@shared/components/ui/Calendar'
import {
  calculateMonthlyDoseMap,
  calculateMonthlyStats,
} from '@calendar/services/doseCalendarService'
import { formatLocalDate, parseLocalDate } from '@utils/dateUtils'
import './DoseCalendar.css'

/**
 * Cores para cada status de dose.
 * @constant {Object.<string, string>}
 */
const STATUS_COLORS = {
  completo: '#10b981', // Verde
  parcial: '#f59e0b', // Âmbar
  perdido: '#ef4444', // Vermelho
  sem_doses: '#6b7280', // Cinza
  futuro: '#6b7280', // Cinza (mesma cor para dias futuros)
}

/**
 * Rótulos em português para cada status.
 * @constant {Object.<string, string>}
 */
const STATUS_LABELS = {
  completo: 'Completo',
  parcial: 'Parcial',
  perdido: 'Perdido',
  sem_doses: 'Sem doses',
  futuro: 'Futuro',
}

/**
 * DoseCalendar - Componente de calendário visual de doses
 *
 * @returns {JSX.Element} Calendário com indicadores de status de doses
 */
function DoseCalendar() {
  // 1. States first (R-010)
  const [selectedDate, setSelectedDate] = useState(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())

  // 2. Context/Hooks
  const { logs, protocols } = useDashboard()

  // 3. Memos
  /**
   * Calcula o mapa de doses para o mês atual em exibição.
   */
  const doseMap = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth() + 1 // JavaScript months are 0-indexed

    return calculateMonthlyDoseMap(logs, protocols, year, month)
  }, [logs, protocols, viewDate])

  /**
   * Calcula estatísticas do mês atual.
   */
  const monthlyStats = useMemo(() => {
    return calculateMonthlyStats(doseMap)
  }, [doseMap])

  /**
   * Gera lista de datas marcadas com suas cores para o Calendar.
   * Formato esperado pelo Calendar: array de strings de data
   */
  const markedDates = useMemo(() => {
    return Object.keys(doseMap).filter((dateStr) => {
      const dayInfo = doseMap[dateStr]
      return dayInfo.expected > 0
    })
  }, [doseMap])

  /**
   * Detalhes do dia selecionado para exibir no painel.
   */
  const selectedDayDetails = useMemo(() => {
    if (!selectedDate) return null

    const dateStr = formatLocalDate(selectedDate)
    const dayInfo = doseMap[dateStr]

    if (!dayInfo) return null

    // Verificar se é um dia futuro
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isSelectedFuture = selectedDate > today

    // Agrupar doses por protocolo
    const protocolDetails = protocols
      .filter((protocol) => {
        // Verificar se o protocolo estava ativo na data selecionada
        const protocolStart = protocol.start_date ? parseLocalDate(protocol.start_date) : null
        const protocolEnd = protocol.end_date ? parseLocalDate(protocol.end_date) : null

        if (protocolStart && selectedDate < protocolStart) return false
        if (protocolEnd && selectedDate > protocolEnd) return false

        return protocol.active
      })
      .map((protocol) => {
        // Contar doses esperadas e tomadas para este protocolo nesta data
        const logsForProtocol = logs.filter((log) => {
          if (log.protocol_id !== protocol.id) return false
          const logDate = parseLocalDate(log.taken_at)
          return formatLocalDate(logDate) === dateStr
        })

        const expectedDoses = protocol.time_schedule?.length || 0
        const takenDoses = logsForProtocol.length

        let status = 'sem_doses'
        if (expectedDoses > 0) {
          if (takenDoses === expectedDoses) status = 'completo'
          else if (takenDoses > 0) status = 'parcial'
          else status = isSelectedFuture ? 'futuro' : 'perdido'
        }

        return {
          id: protocol.id,
          name: protocol.medicines?.name || protocol.medicine_name || 'Medicamento',
          expected: expectedDoses,
          taken: takenDoses,
          status,
          color: STATUS_COLORS[status],
        }
      })

    return {
      date: selectedDate,
      dateStr,
      ...dayInfo,
      status: isSelectedFuture ? 'futuro' : dayInfo.status,
      color: STATUS_COLORS[isSelectedFuture ? 'futuro' : dayInfo.status],
      protocols: protocolDetails,
    }
  }, [selectedDate, doseMap, logs, protocols])

  // 4. Effects
  /**
   * Fecha o painel ao pressionar Escape.
   */
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isPanelOpen) {
        setIsPanelOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isPanelOpen])

  // 5. Handlers last (R-010)
  /**
   * Manipula clique em um dia do calendário.
   *
   * @param {Date} date - Data clicada
   */
  const handleDayClick = useCallback((date) => {
    setSelectedDate(date)
    setIsPanelOpen(true)
  }, [])

  /**
   * Fecha o painel de detalhes.
   */
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  /**
   * Callback para carregar dados do mês (lazy loading).
   * Como usamos useDashboard, os dados já estão disponíveis.
   *
   * @param {number} year - Ano
   * @param {number} month - Mês (0-indexed)
   * @returns {Promise<void>}
   */
  const handleLoadMonth = useCallback(
    async (year, month) => {
      // Atualiza viewDate para disparar recálculo do doseMap
      setViewDate(new Date(year, month, 1))
      return Promise.resolve()
    },
    []
  )

  /**
   * Formata data para exibição no painel.
   *
   * @param {Date} date - Data a formatar
   * @returns {string} Data formatada
   */
  const formatDateDisplay = (date) => {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    return date.toLocaleDateString('pt-BR', options)
  }

  return (
    <div className="dose-calendar">
      <div className="dose-calendar__header">
        <h2 className="dose-calendar__title">Calendário de Doses</h2>
        {monthlyStats && (
          <div className="dose-calendar__stats">
            <span className="dose-calendar__stat">
              <span className="dose-calendar__stat-value">{monthlyStats.adherenceRate}%</span>
              <span className="dose-calendar__stat-label">Adesão</span>
            </span>
            <span className="dose-calendar__stat">
              <span className="dose-calendar__stat-value">{monthlyStats.completeDays}</span>
              <span className="dose-calendar__stat-label">Dias Completos</span>
            </span>
          </div>
        )}
      </div>

      <div className="dose-calendar__legend">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <div key={status} className="dose-calendar__legend-item">
            <span
              className="dose-calendar__legend-dot"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
            <span className="dose-calendar__legend-label">{label}</span>
          </div>
        ))}
      </div>

      <Calendar
        markedDates={markedDates}
        selectedDate={selectedDate}
        onDayClick={handleDayClick}
        enableLazyLoad={false}
        onLoadMonth={handleLoadMonth}
        enableSwipe={true}
        enableMonthPicker={true}
      />

      {/* Painel de detalhes com animação */}
      <AnimatePresence>
        {isPanelOpen && selectedDayDetails && (
          <>
            {/* Overlay */}
            <motion.div
              className="dose-calendar__overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePanel}
            />

            {/* Painel */}
            <motion.div
              className="dose-calendar__panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="dose-calendar__panel-header">
                <h3 className="dose-calendar__panel-title">
                  {formatDateDisplay(selectedDayDetails.date)}
                </h3>
                <button
                  className="dose-calendar__panel-close"
                  onClick={handleClosePanel}
                  aria-label="Fechar painel"
                >
                  ×
                </button>
              </div>

              <div className="dose-calendar__panel-summary">
                <div
                  className="dose-calendar__panel-status"
                  style={{ backgroundColor: selectedDayDetails.color }}
                >
                  <span className="dose-calendar__panel-status-label">
                    {STATUS_LABELS[selectedDayDetails.status]}
                  </span>
                  <span className="dose-calendar__panel-status-count">
                    {selectedDayDetails.taken}/{selectedDayDetails.expected} doses
                  </span>
                </div>
              </div>

              <div className="dose-calendar__panel-protocols">
                <h4 className="dose-calendar__panel-subtitle">Por Protocolo</h4>
                {selectedDayDetails.protocols.length === 0 ? (
                  <p className="dose-calendar__panel-empty">Nenhum protocolo ativo nesta data</p>
                ) : (
                  <ul className="dose-calendar__protocol-list">
                    {selectedDayDetails.protocols.map((protocol) => (
                      <li
                        key={protocol.id}
                        className="dose-calendar__protocol-item"
                        style={{ borderLeftColor: protocol.color }}
                      >
                        <span className="dose-calendar__protocol-name">{protocol.name}</span>
                        <span className="dose-calendar__protocol-status">
                          {protocol.taken}/{protocol.expected} - {STATUS_LABELS[protocol.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DoseCalendar
