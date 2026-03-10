import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { cachedLogService as logService } from '@shared/services'
import { formatLocalDate } from '@utils/dateUtils'
import { adherenceService } from '@services/api/adherenceService'
import { analyzeAdherencePatterns } from '@adherence/services/adherencePatternService'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import LogEntry from '@shared/components/log/LogEntry'
import CalendarWithMonthCache from '@shared/components/ui/CalendarWithMonthCache'
import FloatingActionButton from '@shared/components/ui/FloatingActionButton'
import './HealthHistory.css'

const SparklineAdesao = lazy(() => import('@dashboard/components/SparklineAdesao'))
const AdherenceHeatmap = lazy(() => import('@adherence/components/AdherenceHeatmap'))

const TIMELINE_PAGE_SIZE = 30

export default function HealthHistory({ onNavigate }) {
  // States
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date())
  const [successMessage, setSuccessMessage] = useState('')
  const [currentMonthLogs, setCurrentMonthLogs] = useState([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [adherenceSummary, setAdherenceSummary] = useState(null)
  const [dailyAdherence, setDailyAdherence] = useState([])
  const [adherencePattern, setAdherencePattern] = useState(null)
  // Timeline: lista plana das últimas doses, paginadas por offset
  const [timelineLogs, setTimelineLogs] = useState([])
  const [timelineHasMore, setTimelineHasMore] = useState(false)
  const [timelineOffset, setTimelineOffset] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Context
  const { protocols, stats, refresh } = useDashboard()

  // Estado para análise de padrões (lazy — só carrega quando visível)
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false)
  const observerRef = useRef(null) // observer instance

  // Memos
  const treatmentPlans = useMemo(() => {
    const planMap = new Map()
    protocols.forEach((p) => {
      if (p.treatment_plan_id) {
        planMap.set(p.treatment_plan_id, true)
      }
    })
    return Array.from(planMap.keys())
  }, [protocols])

  const dayLogs = useMemo(() => {
    const d = selectedCalendarDate || new Date()
    return currentMonthLogs.filter((log) => {
      const logDate = new Date(log.taken_at)
      return (
        logDate.getFullYear() === d.getFullYear() &&
        logDate.getMonth() === d.getMonth() &&
        logDate.getDate() === d.getDate()
      )
    })
  }, [currentMonthLogs, selectedCalendarDate])

  const pillsThisMonth = useMemo(
    () => currentMonthLogs.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0),
    [currentMonthLogs]
  )

  const daysThisMonth = useMemo(
    () =>
      new Set(
        currentMonthLogs.map((log) => formatLocalDate(new Date(log.taken_at)))
      ).size,
    [currentMonthLogs]
  )

  // Effects
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const now = new Date()

      // Calendário + Timeline: carregamento crítico — UI fica pronta rápido
      const [logsResult, timelineResult] = await Promise.all([
        logService.getByMonth(now.getFullYear(), now.getMonth()),
        logService.getAllPaginated(TIMELINE_PAGE_SIZE, 0),
      ])

      setCurrentMonthLogs(logsResult.data || [])
      setTotalLogs(logsResult.total || 0)
      setTimelineLogs(timelineResult.data || [])
      setTimelineHasMore(timelineResult.hasMore || false)
      setTimelineOffset(TIMELINE_PAGE_SIZE)

      if (logsResult.data?.length > 0) {
        setSelectedCalendarDate(new Date(logsResult.data[0].taken_at))
      }

      // UI visível primeiro — heatmap carrega via IntersectionObserver quando usuário rolar
      setIsLoading(false)

      const [summary, daily] = await Promise.all([
        adherenceService.getAdherenceSummary('30d').catch(() => null),
        adherenceService.getDailyAdherence(30).catch(() => []),
      ])

      setAdherenceSummary(summary)
      setDailyAdherence(daily)
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Ref callback: chamado quando o sentinel DIV é montado no DOM
  const setSentinelElement = useCallback((sentinel) => {
    if (!sentinel) return

    // Disconnect o observer anterior se existir
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Evitar múltiplas requisições: só disparar quando não estamos carregando E dados ainda não foram carregados
        if (entry.isIntersecting && !isLoadingPatterns && !adherencePattern) {
          setIsLoadingPatterns(true)
          logService
            .getAll(500)
            .then((result) => {
              const logs = result || []

              try {
                const activeProtocols = protocols.filter((p) => p.active)
                if (logs.length > 0 && activeProtocols.length > 0) {
                  const pattern = analyzeAdherencePatterns({
                    logs,
                    protocols: activeProtocols,
                  })
                  setAdherencePattern(pattern)
                  // Desconectar observer após sucesso para evitar requisições redundantes
                  observer.disconnect()
                }
              } catch (err) {
                // Log erros em produção para diagnóstico, sem exposição de PHI
                console.error('[HealthHistory] Erro ao analisar padrões de adesão:', err.message, err)
              }
            })
            .catch((err) => {
              // Log erros em produção para diagnóstico
              console.error('[HealthHistory] Falha ao buscar logs:', err.message, err)
            })
            .finally(() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[HealthHistory] ✅ Chamando setIsLoadingPatterns(false)')
              }
              setIsLoadingPatterns(false)
            })
        }
      },
      { rootMargin: '50px' } // pré-carrega 50px antes de entrar na tela
    )

    observer.observe(sentinel)
    observerRef.current = observer

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [protocols, isLoadingPatterns, adherencePattern])

  // Handlers
  const showSuccess = useCallback((msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }, [])

  const handleCalendarLoadMonth = useCallback(async (year, month) => {
    try {
      const result = await logService.getByMonth(year, month)
      setCurrentMonthLogs(result.data || [])
      setTotalLogs(result.total || 0)
      if (result.data?.length > 0) {
        setSelectedCalendarDate(new Date(result.data[0].taken_at))
      } else {
        setSelectedCalendarDate(new Date(year, month, 1))
      }
      return result
    } catch (err) {
      console.error('Erro ao carregar mês:', err)
      return { data: [], total: 0 }
    }
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
      throw new Error(err.message)
    }
  }, [showSuccess, loadData, refresh])

  const handleDeleteLog = useCallback(async (id) => {
    try {
      await logService.delete(id)
      showSuccess('Registro removido!')
      setCurrentMonthLogs((prev) => prev.filter((log) => log.id !== id))
      setTimelineLogs((prev) => prev.filter((log) => log.id !== id))
      setTotalLogs((prev) => Math.max(0, prev - 1))
      refresh()
    } catch (err) {
      setError('Erro ao remover: ' + err.message)
    }
  }, [showSuccess, refresh])

  const handleEditClick = useCallback((log) => {
    setEditingLog(log)
    setIsModalOpen(true)
  }, [])

  const handleLoadMoreTimeline = async () => {
    if (isLoadingMore || !timelineHasMore) return
    setIsLoadingMore(true)
    try {
      const result = await logService.getAllPaginated(TIMELINE_PAGE_SIZE, timelineOffset)
      setTimelineLogs((prev) => [...prev, ...(result.data || [])])
      setTimelineHasMore(result.hasMore || false)
      setTimelineOffset((o) => o + TIMELINE_PAGE_SIZE)
    } catch (err) {
      console.error('Erro ao carregar mais doses:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  if (isLoading) return <Loading text="Carregando saúde..." />

  // Score do dashboard context (weighted health score)
  const score = stats?.score ?? 0
  const streak = stats?.currentStreak ?? 0
  // Best streak vem do adherence summary (calculado em background)
  const bestStreak = adherenceSummary?.longestStreak ?? streak

  return (
    <div className="health-history-view">
      {/* Header with back button */}
      <div className="health-history-header">
        <button className="health-history-header__back" onClick={() => onNavigate('profile')}>
          ← Minha Saúde
        </button>
      </div>

      {successMessage && (
        <div className="health-history-banner health-history-banner--success">{successMessage}</div>
      )}
      {error && <div className="health-history-banner health-history-banner--error">{error}</div>}

      {/* Adherence summary */}
      <div className="health-history-summary glass-card">
        <div className="health-history-summary__top">
          <div>
            <span className="health-history-summary__label">Adesão 30d</span>
            <span className="health-history-summary__score">{score}%</span>
          </div>
          {adherenceSummary && (
            <span className="health-history-summary__detail">
              {adherenceSummary.overallTaken}/{adherenceSummary.overallExpected} doses
            </span>
          )}
        </div>
        <div className="health-history-summary__bar">
          <div
            className="health-history-summary__fill"
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        <div className="health-history-summary__streak">
          🔥 {streak}d streak · Melhor: {bestStreak}d
        </div>
      </div>

      {/* Calendar */}
      <div className="health-history-calendar glass-card">
        <CalendarWithMonthCache
          onLoadMonth={handleCalendarLoadMonth}
          markedDates={currentMonthLogs.map((log) => formatLocalDate(new Date(log.taken_at)))}
          selectedDate={selectedCalendarDate}
          onDayClick={setSelectedCalendarDate}
        />
        {dayLogs.length > 0 && (
          <div className="health-history-day-detail">
            <h4 className="health-history-day-detail__title">
              Doses de {selectedCalendarDate?.toLocaleDateString('pt-BR')}
            </h4>
            {dayLogs.map((log) => (
              <div
                key={log.id}
                className="health-history-day-log"
                onClick={() => handleEditClick(log)}
              >
                <span className="health-history-day-log__name">{log.medicine?.name}</span>
                <span className="health-history-day-log__time">
                  {new Date(log.taken_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Heatmap de Adesão — carrega lazy via IntersectionObserver */}
      {isLoadingPatterns && (
        <div className="health-history-heatmap glass-card">
          <h3 className="health-history-section-title">Padrões de Adesão</h3>
          <div className="health-history-heatmap-skeleton" aria-busy="true" aria-label="Carregando padrões..." />
        </div>
      )}
      {adherencePattern && !isLoadingPatterns && (
        <div className="health-history-heatmap glass-card">
          <h3 className="health-history-section-title">Padrões de Adesão</h3>
          <Suspense fallback={<div className="health-history-heatmap-skeleton" aria-busy="true" style={{ height: 120 }} />}>
            <AdherenceHeatmap pattern={adherencePattern} />
          </Suspense>
        </div>
      )}

      {/* Sparkline 30d */}
      {dailyAdherence.length > 0 && (
        <div className="health-history-sparkline glass-card">
          <h3 className="health-history-section-title">Adesão 30 dias</h3>
          <Suspense fallback={<div className="health-history-sparkline-skeleton" aria-busy="true" />}>
            <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
          </Suspense>
        </div>
      )}

      {/* Stats */}
      <div className="health-history-stats glass-card">
        <h3 className="health-history-section-title">Stats do Mês</h3>
        <div className="health-history-stats__grid">
          <div className="health-history-stat">
            <span className="health-history-stat__value">{totalLogs}</span>
            <span className="health-history-stat__label">Doses</span>
          </div>
          <div className="health-history-stat">
            <span className="health-history-stat__value">{daysThisMonth}</span>
            <span className="health-history-stat__label">Dias</span>
          </div>
          <div className="health-history-stat">
            <span className="health-history-stat__value">{pillsThisMonth}</span>
            <span className="health-history-stat__label">Comprimidos</span>
          </div>
        </div>
      </div>

      {/* Sentinel: dispara carregamento do heatmap quando usuário chega ao final dos Stats */}
      <div ref={setSentinelElement} />

      {/* Timeline — últimas doses, paginadas */}
      {timelineLogs.length > 0 && (
        <div className="health-history-timeline">
          <h3 className="health-history-section-title">Últimas Doses</h3>
          <Virtuoso
            useWindowScroll
            data={timelineLogs}
            endReached={handleLoadMoreTimeline}
            overscan={300}
            itemContent={(_index, log) => (
              <LogEntry log={log} onEdit={handleEditClick} onDelete={handleDeleteLog} />
            )}
            components={{
              Footer: () =>
                isLoadingMore ? (
                  <div className="health-history-timeline__loading">Carregando...</div>
                ) : !timelineHasMore ? (
                  <div className="health-history-timeline__end">Histórico completo</div>
                ) : null,
            }}
          />
        </div>
      )}

      {/* Floating Action Button */}
      <FloatingActionButton
        onClick={() => {
          setEditingLog(null)
          setIsModalOpen(true)
        }}
      >
        + Registrar Dose
      </FloatingActionButton>

      {/* Log modal */}
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
