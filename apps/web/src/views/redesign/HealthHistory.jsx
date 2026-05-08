// src/views/redesign/HealthHistoryRedesign.jsx
// Wave 10C — Rewrite completo: componente independente calendar-driven (sem Virtuoso, sem wrapper)

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { cachedLogService as logService, cachedAdherenceService as adherenceService } from '@shared/services'
import { formatLocalDate, parseLocalDate, getSaoPauloTime, getTodayLocal, getNow, parseISO } from '@utils/dateUtils'
import HealthHistoryView from './history/HealthHistoryView'
import './history/HistoryRedesign.css'

/** Agrupa protocolos por plano de tratamento (optionally filtra ativos) */
function buildPlansByProtocols(protocols, activeOnly = false) {
  const plansById = {}
  protocols.forEach((p) => {
    if (!p.treatment_plan_id) return
    if (activeOnly && !p.active) return
    if (!plansById[p.treatment_plan_id]) {
      plansById[p.treatment_plan_id] = {
        ...(p.treatment_plan || { id: p.treatment_plan_id, name: 'Plano s/ nome' }),
        protocols: [],
      }
    }
    plansById[p.treatment_plan_id].protocols.push(p)
  })
  return Object.values(plansById)
}

/**
 * Histórico de Doses — Calendar-Driven.
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação
 */
export default function HealthHistory({ onNavigate }) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [selectedDate, setSelectedDate] = useState(getTodayLocal())
  const [currentMonthLogs, setCurrentMonthLogs] = useState([])
  const [, setTotalLogs] = useState(0)
  const [dailyAdherence, setDailyAdherence] = useState([])
  const [adherencePattern, setAdherencePattern] = useState(null)

  const { protocols, stats, refresh } = useDashboard()
  const { mode: complexityMode } = useComplexityMode()
  const isComplex = complexityMode === 'complex'
  const patternLoadedRef = useRef(false)

  const treatmentPlans = useMemo(() => buildPlansByProtocols(protocols, true), [protocols])
  const treatmentPlansAll = useMemo(() => buildPlansByProtocols(protocols, false), [protocols])
  const activeProtocols = useMemo(() => protocols.filter(p => p.active), [protocols])

  const dayLogs = useMemo(() => {
    const dStr = typeof selectedDate === 'string' ? selectedDate : formatLocalDate(selectedDate)
    return currentMonthLogs
      .filter((log) => formatLocalDate(getSaoPauloTime(parseISO(log.taken_at))) === dStr)
      .sort((a, b) => parseISO(a.taken_at) - parseISO(b.taken_at))
  }, [currentMonthLogs, selectedDate])

  const markedDates = useMemo(
    () => currentMonthLogs.map((log) => formatLocalDate(getSaoPauloTime(parseISO(log.taken_at)))),
    [currentMonthLogs]
  )
  const dosesThisMonth = useMemo(() => currentMonthLogs.length, [currentMonthLogs])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const now = getNow()
      const logsResult = await logService.getByMonthSlim(now.getFullYear(), now.getMonth())
      setCurrentMonthLogs(logsResult.data || [])
      setTotalLogs(logsResult.total || 0)
      if (logsResult.data?.length > 0) setSelectedDate(parseISO(logsResult.data[0].taken_at))
      setIsLoading(false)

      if (isComplex) {
        const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))
        scheduleIdle(async () => {
          try {
            const daily = await adherenceService.getDailyAdherenceFromView(90)
            setDailyAdherence(daily)
          } catch (err) { console.error('[HistoryRedesign] Erro daily adherence:', err.message) }
          if (!patternLoadedRef.current) {
            try {
              const pattern = await adherenceService.getAdherencePatternFromView()
              setAdherencePattern(pattern)
              patternLoadedRef.current = true
            } catch (err) { console.error('[HistoryRedesign] Erro pattern:', err.message) }
          }
        })
      }
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
      setIsLoading(false)
    }
  }, [isComplex])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    window.addEventListener('mr:dose-saved', loadData)
    return () => window.removeEventListener('mr:dose-saved', loadData)
  }, [loadData])

  const showSuccess = useCallback((msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }, [])

  const handleCalendarLoadMonth = useCallback(async (year, month) => {
    try {
      const result = await logService.getByMonthSlim(year, month)
      setCurrentMonthLogs(result.data || [])
      setTotalLogs(result.total || 0)
      const firstDate = result.data?.length > 0
        ? parseISO(result.data[0].taken_at)
        : parseLocalDate(`${year}-${String(month + 1).padStart(2, '0')}-01`)
      setSelectedDate(firstDate)
      return result
    } catch (err) { console.error('[HistoryRedesign] Erro ao carregar mês:', err); return { data: [], total: 0 } }
  }, [])

  const handleLogMedicine = useCallback(async (logData) => {
    try {
      if (logData.id) {
        await logService.update(logData.id, logData)
        showSuccess('Registro atualizado!')
      } else if (Array.isArray(logData)) {
        await logService.createBulk(logData)
        showSuccess('Plano registrado!')
      } else {
        await logService.create(logData)
        showSuccess('Dose registrada!')
      }
      setIsModalOpen(false)
      setEditingLog(null)
      await loadData()
      refresh()
    } catch (err) {
      console.error('[HistoryRedesign] Erro ao salvar/atualizar log:', err)
      throw new Error(err.message)
    }
  }, [loadData, refresh, showSuccess])

  const handleDeleteLog = useCallback(async (id) => {
    try {
      await logService.delete(id)
      showSuccess('Registro removido!')
      setCurrentMonthLogs((prev) => prev.filter((log) => log.id !== id))
      setTotalLogs((prev) => Math.max(0, prev - 1))
      refresh()
    } catch (err) { setError('Erro ao remover: ' + err.message) }
  }, [refresh, showSuccess])

  const handleEditClick = useCallback((log) => { setEditingLog(log); setIsModalOpen(true) }, [])
  const handleCloseModal = useCallback(() => { setIsModalOpen(false); setEditingLog(null) }, [])

  if (isLoading) return (
    <div className="hhr-view">
      <div className="hhr-loading">
        <div className="hhr-loading__spinner" />
        <span>Carregando histórico...</span>
      </div>
    </div>
  )

  return (
    <HealthHistoryView
      onNavigate={onNavigate}
      successMessage={successMessage}
      error={error}
      isComplex={isComplex}
      dailyAdherence={dailyAdherence}
      adherencePattern={adherencePattern}
      stats={stats}
      dosesThisMonth={dosesThisMonth}
      selectedDate={selectedDate}
      markedDates={markedDates}
      dayLogs={dayLogs}
      isModalOpen={isModalOpen}
      editingLog={editingLog}
      protocols={protocols}
      activeProtocols={activeProtocols}
      treatmentPlans={treatmentPlans}
      treatmentPlansAll={treatmentPlansAll}
      onDayClick={(date) => setSelectedDate(date)}
      onLoadMonth={handleCalendarLoadMonth}
      onEditLog={handleEditClick}
      onDeleteLog={handleDeleteLog}
      onSaveLog={handleLogMedicine}
      onCloseModal={handleCloseModal}
    />
  )
}
