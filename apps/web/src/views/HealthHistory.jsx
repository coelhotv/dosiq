// src/views/HealthHistory.jsx
// Wave 10C — componente independente calendar-driven.
// PR-F4.2/S4.3+S4.4 — fonte migrada de logService.getByMonthSlim (logs tomados) para
// timelineService.getMonthTimeline (eventos taken/missed/pending de dose_instances, FP-3).
// Fecha G1 no caminho da timeline: o fuso do usuário (user_settings.timezone) é injetado
// ponta-a-ponta e governa a derivação do dia local (cross-meia-noite correto, sem double-shift).

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { cachedLogService as logService, cachedAdherenceService as adherenceService } from '@shared/services'
import { timelineService } from '@services/api/timelineService'
import { measuresRepo } from '@features/measures/services/measuresRepo'
import { formatLocalDate, getTodayLocal, getNow } from '@utils/dateUtils'
import HealthHistoryView from './history/HealthHistoryView'
import './history/HistoryRedesign.css'

/** Ordem fixa dos dots acumulados no dia: 🟢 tomada · ⚪ pendente · 🔴 perdida. */
const STATUS_DOT_ORDER = ['taken', 'pending', 'missed']

/** Piso de navegação do calendário: dados de `dose_instances` começam em 2026
 *  (pré-backfill não materializado) — não navegar para meses vazios anteriores. */
const CALENDAR_FLOOR_YEAR = 2026

/** Enriquece o payload do evento com nome/unidade do medicamento (resolvido no render,
 *  NÃO no fetch — mantém os callbacks de carga estáveis e imunes a refetch de protocolos). */
function enrichEvent(ev, protocolsById) {
  const p = protocolsById[ev.payload?.protocolId]
  if (!p) return ev
  return {
    ...ev,
    payload: {
      ...ev.payload,
      medicineName: ev.payload.medicineName ?? p.medicine?.name ?? p.medicine_name ?? null,
      dosageUnit: ev.payload.dosageUnit ?? p.dosage_unit ?? p.medicine?.dosage_unit ?? null,
      // 022: unidade de tomada + densidade + concentração p/ exibir dose líquida correta.
      intakeUnit: ev.payload.intakeUnit ?? p.intake_unit ?? null,
      unitsPerMl: ev.payload.unitsPerMl ?? p.medicine?.units_per_ml ?? null,
      dosagePerPill: ev.payload.dosagePerPill ?? p.medicine?.dosage_per_pill ?? null,
    },
  }
}

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
 * Histórico de Doses — Calendar-Driven sobre a timeline event-agnóstica.
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação
 */
function useHistoryDoseLog(loadData, refresh, showSuccess, setIsModalOpen, setEditingLog, setError) {
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
  }, [loadData, refresh, showSuccess, setIsModalOpen, setEditingLog])

  const handleDeleteLog = useCallback(async (id) => {
    // Confirmação de ação irreversível (faltava — bug do smoke).
    if (!window.confirm('Excluir este registro de dose? Esta ação não pode ser desfeita.')) return
    try {
      await logService.delete(id)
      showSuccess('Registro removido!')
      await loadData()
      refresh()
    } catch (err) { setError('Erro ao remover: ' + err.message) }
  }, [loadData, refresh, showSuccess, setError])

  return { handleLogMedicine, handleDeleteLog }
}

function useAdherenceCharts(isComplex) {
  const [dailyAdherence, setDailyAdherence] = useState([])
  const [adherencePattern, setAdherencePattern] = useState(null)
  const patternLoadedRef = useRef(false)

  const loadAdherenceCharts = useCallback(() => {
    if (!isComplex) return
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
  }, [isComplex])

  return { dailyAdherence, adherencePattern, loadAdherenceCharts }
}

function useMeasureActions(loadData, showSuccess, setError, setMeasureModalOpen, setEditingMeasure) {
  const handleDeleteMeasure = useCallback(async (m) => {
    if (!window.confirm('Excluir esta medida? Esta ação não pode ser desfeita.')) return
    try {
      await measuresRepo.remove(m.id)
      showSuccess('Medida removida!')
      window.dispatchEvent(new CustomEvent('mr:measure-saved'))
      await loadData()
    } catch (err) { setError('Erro ao remover: ' + err.message) }
  }, [loadData, showSuccess, setError])

  const handleSaveMeasure = useCallback(async (payload) => {
    let saved
    if (payload.id) {
      const patch = { ...payload }
      delete patch.id
      saved = await measuresRepo.update(payload.id, patch)
    } else {
      saved = await measuresRepo.create(payload)
    }
    window.dispatchEvent(new CustomEvent('mr:measure-saved'))
    await loadData()
    setMeasureModalOpen(false)
    setEditingMeasure(null)
    return saved
  }, [loadData, setMeasureModalOpen, setEditingMeasure])

  return { handleDeleteMeasure, handleSaveMeasure }
}

function useHealthHistoryState() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [editingMeasure, setEditingMeasure] = useState(null)
  const [measureModalOpen, setMeasureModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getTodayLocal())
  const [monthEvents, setMonthEvents] = useState([])
  const [timezone, setTimezone] = useState('America/Sao_Paulo')

  const { protocols, refresh } = useDashboard()
  const { mode: complexityMode } = useComplexityMode()
  const isComplex = complexityMode === 'complex'

  const { dailyAdherence, adherencePattern, loadAdherenceCharts } = useAdherenceCharts(isComplex)

  const treatmentPlans = useMemo(() => buildPlansByProtocols(protocols, true), [protocols])
  const treatmentPlansAll = useMemo(() => buildPlansByProtocols(protocols, false), [protocols])
  const activeProtocols = useMemo(() => protocols.filter((p) => p.active), [protocols])

  // Mapa p/ enriquecer o payload do evento (nome/unidade do medicamento) no adapter.
  const protocolsById = useMemo(() => {
    const map = {}
    protocols.forEach((p) => { map[p.id] = p })
    return map
  }, [protocols])

  // Eventos do dia selecionado: o builder já anexou `localDay` derivado no fuso do usuário.
  // Enriquecimento (nome/unidade) é aplicado aqui no render, não no fetch.
  const dayEvents = useMemo(() => {
    const dStr = typeof selectedDate === 'string' ? selectedDate : formatLocalDate(selectedDate)
    return monthEvents.filter((ev) => ev.localDay === dStr).map((ev) => enrichEvent(ev, protocolsById))
  }, [monthEvents, selectedDate, protocolsById])

  // Dias com eventos no mês (marcação no calendário) — derivados do localDay no fuso.
  const markedDates = useMemo(
    () => Array.from(new Set(monthEvents.map((ev) => ev.localDay).filter(Boolean))),
    [monthEvents]
  )

  // Status presentes em cada dia → dots acumulados (🟢⚪🔴) em ordem fixa.
  const markedStatusesByDay = useMemo(() => {
    const byDay = {}
    for (const ev of monthEvents) {
      if (ev.type !== 'dose') continue // só doses pintam dot de status (FP-3)
      const day = ev.localDay
      if (!day) continue
      const st = ev.payload?.status || 'pending'
      ;(byDay[day] ||= new Set()).add(st)
    }
    const out = {}
    for (const [day, set] of Object.entries(byDay)) {
      out[day] = STATUS_DOT_ORDER.filter((s) => set.has(s))
    }
    return out
  }, [monthEvents])

  const dosesThisMonth = useMemo(() => monthEvents.length, [monthEvents])

  // Range do calendário: piso em jan/CALENDAR_FLOOR_YEAR (offset relativo a hoje), teto m+1.
  const monthPickerRange = useMemo(() => {
    const now = getNow()
    const monthsSinceFloor = (now.getFullYear() - CALENDAR_FLOOR_YEAR) * 12 + now.getMonth()
    return { start: -Math.max(0, monthsSinceFloor), end: 1 }
  }, [])

  // loadData NÃO depende de protocolsById (enrich é no render) → identidade estável,
  // imune a refetch de protocolos no refocus da aba (não recarrega/reseta o mês — AP-192 classe).
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const now = getNow()
      const { events, tz } = await timelineService.getMonthTimeline(now.getFullYear(), now.getMonth())
      setMonthEvents(events)
      setTimezone(tz)
      setIsLoading(false)
      loadAdherenceCharts()
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
      setIsLoading(false)
    }
  }, [loadAdherenceCharts])

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

  // Estável (sem protocolsById). Seleção: se for o mês ATUAL → hoje (UX prática, comportamento
  // legado); senão → 1º dia do mês. Imune a refocus (identidade constante).
  const handleCalendarLoadMonth = useCallback(async (year, month) => {
    try {
      const { events, tz } = await timelineService.getMonthTimeline(year, month)
      setMonthEvents(events)
      setTimezone(tz)
      const today = getTodayLocal() // 'YYYY-MM-DD'
      const isCurrentMonth = Number(today.slice(0, 4)) === year && Number(today.slice(5, 7)) - 1 === month
      setSelectedDate(isCurrentMonth ? today : `${year}-${String(month + 1).padStart(2, '0')}-01`)
      return { data: events, total: events.length }
    } catch (err) {
      console.error('[HistoryRedesign] Erro ao carregar mês:', err)
      return { data: [], total: 0 }
    }
  }, [])

  const { handleLogMedicine, handleDeleteLog } = useHistoryDoseLog(
    loadData,
    refresh,
    showSuccess,
    setIsModalOpen,
    setEditingLog,
    setError
  )

  const handleEditClick = useCallback((log) => { setEditingLog(log); setIsModalOpen(true) }, [])
  const handleCloseModal = useCallback(() => { setIsModalOpen(false); setEditingLog(null) }, [])

  // 012 Fase C: edição/exclusão de biomarcador a partir do card do dia.
  const handleEditMeasure = useCallback((m) => { setEditingMeasure(m); setMeasureModalOpen(true) }, [])
  const handleCloseMeasureModal = useCallback(() => { setMeasureModalOpen(false); setEditingMeasure(null) }, [])

  const { handleDeleteMeasure, handleSaveMeasure } = useMeasureActions(
    loadData,
    showSuccess,
    setError,
    setMeasureModalOpen,
    setEditingMeasure
  )

  return {
    isLoading,
    error,
    successMessage,
    isModalOpen,
    editingLog,
    selectedDate,
    timezone,
    dailyAdherence,
    adherencePattern,
    isComplex,
    treatmentPlans,
    treatmentPlansAll,
    activeProtocols,
    dayEvents,
    markedDates,
    markedStatusesByDay,
    dosesThisMonth,
    monthPickerRange,
    editingMeasure,
    measureModalOpen,
    setSelectedDate,
    handleCalendarLoadMonth,
    handleLogMedicine,
    handleDeleteLog,
    handleEditClick,
    handleCloseModal,
    handleEditMeasure,
    handleDeleteMeasure,
    handleSaveMeasure,
    handleCloseMeasureModal,
  }
}

export default function HealthHistory({ onNavigate }) {
  const {
    isLoading,
    error,
    successMessage,
    isModalOpen,
    editingLog,
    selectedDate,
    timezone,
    dailyAdherence,
    adherencePattern,
    isComplex,
    treatmentPlans,
    treatmentPlansAll,
    activeProtocols,
    dayEvents,
    markedDates,
    markedStatusesByDay,
    dosesThisMonth,
    monthPickerRange,
    editingMeasure,
    measureModalOpen,
    setSelectedDate,
    handleCalendarLoadMonth,
    handleLogMedicine,
    handleDeleteLog,
    handleEditClick,
    handleCloseModal,
    handleEditMeasure,
    handleDeleteMeasure,
    handleSaveMeasure,
    handleCloseMeasureModal,
  } = useHealthHistoryState()

  const { protocols, stats } = useDashboard()

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
      markedStatusesByDay={markedStatusesByDay}
      monthPickerRange={monthPickerRange}
      timezone={timezone}
      dayEvents={dayEvents}
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
      editingMeasure={editingMeasure}
      measureModalOpen={measureModalOpen}
      onEditMeasure={handleEditMeasure}
      onDeleteMeasure={handleDeleteMeasure}
      onSaveMeasure={handleSaveMeasure}
      onCloseMeasureModal={handleCloseMeasureModal}
    />
  )
}
