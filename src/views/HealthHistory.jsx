import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { cachedLogService as logService } from '@shared/services'
import { formatLocalDate } from '@utils/dateUtils'
import { adherenceService } from '@services/api/adherenceService'
import { analyzeAdherencePatterns } from '@adherence/services/adherencePatternService'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import LogEntry from '@shared/components/log/LogEntry'
import CalendarWithMonthCache from '@shared/components/ui/CalendarWithMonthCache'
import SparklineAdesao from '@dashboard/components/SparklineAdesao'
import AdherenceHeatmap from '@adherence/components/AdherenceHeatmap'
import './HealthHistory.css'

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

  // Estados adicionais para análise de padrões
  const [allLogsForAnalysis, setAllLogsForAnalysis] = useState([])

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

  const adherencePatternData = useMemo(() => {
    try {
      // Usar TODOS os logs históricos para análise de padrões (não apenas os últimos 30 da timeline)
      // Isso garante que o AdherenceHeatmap possa detectar padrões ao longo de >21 dias
      if (allLogsForAnalysis.length > 0 && protocols.length > 0) {
        const pattern = analyzeAdherencePatterns({
          logs: allLogsForAnalysis,
          protocols: protocols.filter((p) => p.active),
        })
        return pattern
      }
      return null
    } catch (err) {
      console.error('Erro ao analisar padrões de adesão:', err)
      return null
    }
  }, [allLogsForAnalysis, protocols])

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

      // UI visível primeiro — análise de padrões carrega em background
      setIsLoading(false)

      // Histórico para AdherenceHeatmap: máx 500 logs (≈90 dias com múltiplos protocolos)
      // Feito em background para não bloquear a renderização inicial no mobile
      logService.getAll(500).then((allLogsResult) => {
        setAllLogsForAnalysis(allLogsResult || [])
      }).catch(() => {
        // Silencioso: heatmap simplesmente não renderiza se falhar
      })

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

  useEffect(() => {
    setAdherencePattern(adherencePatternData)
  }, [adherencePatternData])

  // Handlers
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

  const handleLogMedicine = async (logData) => {
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
  }

  const handleDeleteLog = async (id) => {
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
  }

  const handleEditClick = (log) => {
    setEditingLog(log)
    setIsModalOpen(true)
  }

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

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  if (isLoading) return <Loading text="Carregando saúde..." />

  // Score do dashboard context (weighted health score)
  const score = stats?.score ?? 0
  const streak = stats?.currentStreak ?? 0
  // Best streak vem do adherence summary (calculado em background)
  const bestStreak = adherenceSummary?.longestStreak ?? streak
  const pillsThisMonth = currentMonthLogs.reduce((sum, log) => sum + log.quantity_taken, 0)
  const daysThisMonth = new Set(
    currentMonthLogs.map((log) => new Date(log.taken_at).toLocaleDateString('pt-BR'))
  ).size

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

      {/* Heatmap de Adesão */}
      {adherencePattern && (
        <div className="health-history-heatmap glass-card">
          <h3 className="health-history-section-title">Padrões de Adesão</h3>
          <AdherenceHeatmap pattern={adherencePattern} />
        </div>
      )}

      {/* Sparkline 30d */}
      {dailyAdherence.length > 0 && (
        <div className="health-history-sparkline glass-card">
          <h3 className="health-history-section-title">Adesão 30 dias</h3>
          <SparklineAdesao adherenceByDay={dailyAdherence} size="expanded" />
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

      {/* Timeline — últimas doses, paginadas */}
      {timelineLogs.length > 0 && (
        <div className="health-history-timeline">
          <h3 className="health-history-section-title">Últimas Doses</h3>
          {timelineLogs.map((log) => (
            <LogEntry key={log.id} log={log} onEdit={handleEditClick} onDelete={handleDeleteLog} />
          ))}
          {timelineHasMore && (
            <button
              className="health-history-timeline__more"
              onClick={handleLoadMoreTimeline}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Carregando...' : `Ver mais ${TIMELINE_PAGE_SIZE} doses`}
            </button>
          )}
        </div>
      )}

      {/* Register dose CTA */}
      <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
        <Button
          variant="primary"
          onClick={() => {
            setEditingLog(null)
            setIsModalOpen(true)
          }}
        >
          Registrar Dose
        </Button>
      </div>

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
