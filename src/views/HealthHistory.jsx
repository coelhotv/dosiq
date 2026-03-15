import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { cachedLogService as logService } from '@shared/services'
import { formatLocalDate } from '@utils/dateUtils'
import { cachedAdherenceService as adherenceService } from '@shared/services'
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
  const patternLoadedRef = useRef(false) // M3: previne múltiplas requisições
  const isLoadingPatternsRef = useRef(false) // M8: evita closure stale no observer callback

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
    () => new Set(currentMonthLogs.map((log) => formatLocalDate(new Date(log.taken_at)))).size,
    [currentMonthLogs]
  )

  // Effects
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const now = new Date()

      // ── Phase 1: UI-critical (calendário + timeline) ──
      // Máximo 2 requests simultâneos. Cache SWR resolve em <5ms se fresh.
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

      // UI fica interativa AQUI — browser pode pintar calendário + timeline
      setIsLoading(false)

      // ── Phase 2: Deferido — sparkline + summary após paint ──
      // requestIdleCallback permite ao browser completar o paint antes de disparar queries.
      // Safari não suporta requestIdleCallback — fallback para setTimeout(100ms).
      const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 100))

      scheduleIdle(() => {
        // Sparkline: 1 query leve (v_daily_adherence view, ~30 rows)
        adherenceService
          .getDailyAdherenceFromView(90)
          .then((daily) => setDailyAdherence(daily))
          .catch((err) =>
            console.error('[HealthHistory] ERRO ao carregar daily adherence:', err.message)
          )
          .then(() => {
            // Summary completo — APÓS sparkline resolver
            // Serializado para nunca ter >1 query ativa do HealthHistory
            adherenceService
              .getAdherenceSummary('90d')
              .then((summary) => setAdherenceSummary(summary))
              .catch((err) =>
                console.error('[HealthHistory] ERRO ao carregar summary:', err.message)
              )
          })
      })
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Ref callback: chamado quando o sentinel DIV é montado no DOM
  // M3 — Carrega padrões de adesão diretamente da view (zero processamento client)
  // M8 — Deps [] para evitar recreação desnecessária; isLoadingPatternsRef para closure estável
  const setSentinelElement = useCallback((sentinel) => {
    // Null-path: React chama com null antes de montar com novo elemento
    // Desconectar observer antigo para evitar chamadas duplas
    if (!sentinel) {
      observerRef.current?.disconnect()
      observerRef.current = null
      return
    }

    // Garantir que qualquer observer anterior está desconectado
    observerRef.current?.disconnect()

    const observer = new IntersectionObserver(
      ([entry]) => {
        // isLoadingPatternsRef evita duplo disparo sem fechar sobre state stale
        if (entry.isIntersecting && !patternLoadedRef.current && !isLoadingPatternsRef.current) {
          isLoadingPatternsRef.current = true
          setIsLoadingPatterns(true)
          // M3: Chamar view ao invés de processar 500 logs no client (O(N) → O(1))
          adherenceService
            .getAdherencePatternFromView()
            .then((pattern) => {
              patternLoadedRef.current = true
              setAdherencePattern(pattern)
              // Desconectar observer após sucesso para evitar requisições redundantes
              observer.disconnect()
            })
            .catch((err) => {
              // Log erros em produção para diagnóstico, sem exposição de PHI
              console.error('[HealthHistory] Falha ao buscar padrões de adesão:', err.message, err)
              patternLoadedRef.current = false // Permitir retry
            })
            .finally(() => {
              isLoadingPatternsRef.current = false
              setIsLoadingPatterns(false)
            })
        }
      },
      { rootMargin: '50px' } // pré-carrega 50px antes de entrar na tela
    )

    observer.observe(sentinel)
    observerRef.current = observer
  }, [])

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

  const handleLogMedicine = useCallback(
    async (logData) => {
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
    },
    [showSuccess, loadData, refresh]
  )

  const handleDeleteLog = useCallback(
    async (id) => {
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
    },
    [showSuccess, refresh]
  )

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
  // Doses taken/expected: usa adherenceSummary quando disponível, stats como fallback imediato
  const overallTaken = adherenceSummary?.overallTaken ?? stats?.taken ?? 0
  const overallExpected = adherenceSummary?.overallExpected ?? stats?.expected ?? 0

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
          {overallExpected > 0 && (
            <span className="health-history-summary__detail">
              {overallTaken}/{overallExpected} doses
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
          <div
            className="health-history-heatmap-skeleton"
            aria-busy="true"
            aria-label="Carregando padrões..."
          />
        </div>
      )}
      {adherencePattern && !isLoadingPatterns && (
        <div className="health-history-heatmap glass-card">
          <h3 className="health-history-section-title">Padrões de Adesão</h3>
          <Suspense
            fallback={
              <div
                className="health-history-heatmap-skeleton"
                aria-busy="true"
                style={{ height: 120 }}
              />
            }
          >
            <AdherenceHeatmap pattern={adherencePattern} />
          </Suspense>
        </div>
      )}

      {/* Sparkline 30d */}
      {dailyAdherence.length > 0 && (
        <div className="health-history-sparkline glass-card">
          <h3 className="health-history-section-title">Adesão 30 dias</h3>
          <Suspense
            fallback={<div className="health-history-sparkline-skeleton" aria-busy="true" />}
          >
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
