// src/views/redesign/HealthHistoryRedesign.jsx
// Wave 10C — Rewrite completo: componente independente calendar-driven (sem Virtuoso, sem wrapper)

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { cachedLogService as logService } from '@shared/services'
import { cachedAdherenceService as adherenceService } from '@shared/services'
import { formatLocalDate, parseLocalDate } from '@utils/dateUtils'
import Calendar from '@shared/components/ui/Calendar'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import HistoryKPICards from './history/HistoryKPICards'
import HistoryDayPanel from './history/HistoryDayPanel'
import './history/HistoryRedesign.css'

// Lazy: só carrega em modo complex
const SparklineAdesao = lazy(() => import('@dashboard/components/SparklineAdesao'))
const AdherenceHeatmap = lazy(() => import('@adherence/components/AdherenceHeatmap'))

/**
 * Histórico de Doses — Calendar-Driven.
 *
 * Paradigma: calendário é o controle principal de navegação.
 * Fluxo: Selecionar mês → Clicar dia → Ver doses → Editar/Deletar.
 *
 * Performance: 1 query por mês (getByMonthSlim), dados carregados on-demand.
 * SEM Virtuoso, SEM scroll infinito, SEM paginação global.
 *
 * @param {Object} props
 * @param {Function} props.onNavigate - Callback de navegação (para 'profile', etc.)
 */
export default function HealthHistoryRedesign({ onNavigate }) {
  // ═══ States ═══
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentMonthLogs, setCurrentMonthLogs] = useState([])
  const [, setTotalLogs] = useState(0)

  // Dados para modo complex (sparkline + heatmap)
  const [dailyAdherence, setDailyAdherence] = useState([])
  const [adherencePattern, setAdherencePattern] = useState(null)

  // ═══ Context ═══
  const { protocols, stats, refresh } = useDashboard()
  const { mode: complexityMode } = useComplexityMode()
  const isComplex = complexityMode === 'complex'

  // ═══ Refs ═══
  const patternLoadedRef = useRef(false)

  // ═══ Memos ═══

  // Planos de tratamento (para LogForm)
  const treatmentPlans = useMemo(() => {
    const planMap = new Map()
    protocols.forEach((p) => {
      if (p.treatment_plan_id) {
        planMap.set(p.treatment_plan_id, true)
      }
    })
    return Array.from(planMap.keys())
  }, [protocols])

  // Doses do dia selecionado — filtra dos logs do mês carregado, ordenados ascendente
  const dayLogs = useMemo(() => {
    const d = selectedDate || new Date()
    return currentMonthLogs
      .filter((log) => {
        const logDate = new Date(log.taken_at)
        return (
          logDate.getFullYear() === d.getFullYear() &&
          logDate.getMonth() === d.getMonth() &&
          logDate.getDate() === d.getDate()
        )
      })
      .sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at))
  }, [currentMonthLogs, selectedDate])

  // Datas marcadas no calendário (array de strings 'YYYY-MM-DD')
  const markedDates = useMemo(
    () => currentMonthLogs.map((log) => formatLocalDate(new Date(log.taken_at))),
    [currentMonthLogs]
  )

  // Contadores do mês (para KPI "Doses este Mês")
  const dosesThisMonth = useMemo(() => currentMonthLogs.length, [currentMonthLogs])

  // ═══ Effects ═══

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const now = new Date()

      // Phase 1: UI-critical — logs do mês atual (calendário + day panel)
      const logsResult = await logService.getByMonthSlim(now.getFullYear(), now.getMonth())
      setCurrentMonthLogs(logsResult.data || [])
      setTotalLogs(logsResult.total || 0)

      // Selecionar dia mais recente com dose (ou hoje)
      if (logsResult.data?.length > 0) {
        setSelectedDate(new Date(logsResult.data[0].taken_at))
      }

      // UI fica interativa AQUI
      setIsLoading(false)

      // Phase 2: Dados deferidos (só se complex)
      if (isComplex) {
        const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))
        scheduleIdle(async () => {
          try {
            const daily = await adherenceService.getDailyAdherenceFromView(90)
            setDailyAdherence(daily)
          } catch (err) {
            console.error('[HistoryRedesign] Erro daily adherence:', err.message)
          }

          // Heatmap: carregar direto (sem IntersectionObserver)
          if (!patternLoadedRef.current) {
            try {
              const pattern = await adherenceService.getAdherencePatternFromView()
              setAdherencePattern(pattern)
              patternLoadedRef.current = true
            } catch (err) {
              console.error('[HistoryRedesign] Erro pattern:', err.message)
            }
          }
        })
      }
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
      setIsLoading(false)
    }
  }, [isComplex])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  // Escuta evento global de dose salva (GlobalDoseModal) para recarregar
  useEffect(() => {
    const handleDoseSaved = () => loadData()
    window.addEventListener('mr:dose-saved', handleDoseSaved)
    return () => window.removeEventListener('mr:dose-saved', handleDoseSaved)
  }, [loadData])

  // ═══ Handlers ═══

  const showSuccess = useCallback((msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }, [])

  const handleCalendarLoadMonth = useCallback(async (year, month) => {
    try {
      const result = await logService.getByMonthSlim(year, month)
      setCurrentMonthLogs(result.data || [])
      setTotalLogs(result.total || 0)
      // Selecionar primeiro dia com dose no novo mês, ou dia 1
      if (result.data?.length > 0) {
        setSelectedDate(new Date(result.data[0].taken_at))
      } else {
        setSelectedDate(parseLocalDate(`${year}-${String(month + 1).padStart(2, '0')}-01`))
      }
      return result
    } catch (err) {
      console.error('[HistoryRedesign] Erro ao carregar mês:', err)
      return { data: [], total: 0 }
    }
  }, [])

  const handleDayClick = useCallback((date) => {
    setSelectedDate(date)
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
      // Remover do state local (otimismo) — evita reload completo
      setCurrentMonthLogs((prev) => prev.filter((log) => log.id !== id))
      setTotalLogs((prev) => Math.max(0, prev - 1))
      refresh()
    } catch (err) {
      setError('Erro ao remover: ' + err.message)
    }
  }, [refresh, showSuccess])

  const handleEditClick = useCallback((log) => {
    setEditingLog(log)
    setIsModalOpen(true)
  }, [])

  // ═══ Render ═══

  if (isLoading) {
    return (
      <div className="hhr-view">
        <div className="hhr-loading">
          <div className="hhr-loading__spinner" />
          <span>Carregando histórico...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="hhr-view">
      {/* ── Header ── */}
      <div className="hhr-header">
        {onNavigate && (
          <button className="hhr-back-btn" onClick={() => onNavigate('profile')} aria-label="Voltar">
            ← Voltar
          </button>
        )}
        <h1 className="hhr-header__title">Histórico de Doses</h1>
        <p className="hhr-header__subtitle">
          Acompanhe sua jornada de saúde e adesão ao tratamento.
        </p>
      </div>

      {/* ── Feedback messages ── */}
      {successMessage && (
        <div className="hhr-banner hhr-banner--success">{successMessage}</div>
      )}
      {error && (
        <div className="hhr-banner hhr-banner--error">{error}</div>
      )}

      {/* ── KPI Cards ── */}
      <HistoryKPICards
        adherenceScore={stats?.score ?? 0}
        currentStreak={stats?.currentStreak ?? 0}
        dosesThisMonth={dosesThisMonth}
      />

      {/* ── Calendar + Day Panel ── */}
      <div className="hhr-calendar-section">
        <div className="hhr-calendar-card">
          <Calendar
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
            onLoadMonth={handleCalendarLoadMonth}
            markedDates={markedDates}
            enableLazyLoad={true}
            enableSwipe={true}
            enableMonthPicker={true}
          />
        </div>

        <HistoryDayPanel
          selectedDate={selectedDate}
          dayLogs={dayLogs}
          onEditLog={handleEditClick}
          onDeleteLog={handleDeleteLog}
        />
      </div>

      {/* ── Sparkline 30d (complex only) ── */}
      {isComplex && dailyAdherence.length > 0 && (
        <div className="hhr-chart-card">
          <h3 className="hhr-section-title">Adesão 30 Dias</h3>
          <Suspense fallback={<div className="hhr-chart-skeleton" aria-busy="true" />}>
            <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
          </Suspense>
        </div>
      )}

      {/* ── Adherence Heatmap (complex only) ── */}
      {isComplex && adherencePattern && (
        <div className="hhr-chart-card">
          <h3 className="hhr-section-title">Padrão por Período</h3>
          <Suspense fallback={<div className="hhr-chart-skeleton" aria-busy="true" />}>
            <AdherenceHeatmap pattern={adherencePattern} />
          </Suspense>
        </div>
      )}

      {/* ── Modal de edição ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingLog(null)
        }}
      >
        <LogForm
          protocols={protocols}
          treatmentPlans={treatmentPlans}
          initialValues={editingLog}
          onSave={handleLogMedicine}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingLog(null)
          }}
        />
      </Modal>
    </div>
  )
}
