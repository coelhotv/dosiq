import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { logService } from '@shared/services'
import { adherenceService } from '@services/api/adherenceService'
import Button from '@shared/components/ui/Button'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import LogEntry from '@shared/components/log/LogEntry'
import CalendarWithMonthCache from '@shared/components/ui/CalendarWithMonthCache'
import SparklineAdesao from '@dashboard/components/SparklineAdesao'
import './HealthHistory.css'

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

  // Context
  const { protocols, stats, refresh } = useDashboard()

  // Memos
  const treatmentPlans = useMemo(() => {
    const planMap = new Map()
    protocols.forEach(p => {
      if (p.treatment_plan_id) {
        planMap.set(p.treatment_plan_id, true)
      }
    })
    return Array.from(planMap.keys())
  }, [protocols])

  const groupedLogs = useMemo(() => {
    const grouped = {}
    currentMonthLogs.forEach(log => {
      const date = new Date(log.taken_at).toLocaleDateString('pt-BR')
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(log)
    })
    return grouped
  }, [currentMonthLogs])

  const sortedDates = useMemo(() =>
    Object.keys(groupedLogs).sort((a, b) => {
      const [dA, mA, yA] = a.split('/')
      const [dB, mB, yB] = b.split('/')
      return new Date(yB, mB - 1, dB) - new Date(yA, mA - 1, dA)
    }),
    [groupedLogs]
  )

  const dayLogs = useMemo(() => {
    const d = selectedCalendarDate || new Date()
    return currentMonthLogs.filter(log => {
      const logDate = new Date(log.taken_at)
      return logDate.getFullYear() === d.getFullYear()
        && logDate.getMonth() === d.getMonth()
        && logDate.getDate() === d.getDate()
    })
  }, [currentMonthLogs, selectedCalendarDate])

  // Effects
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const now = new Date()

      const [logsResult, summary, daily] = await Promise.all([
        logService.getByMonth(now.getFullYear(), now.getMonth()),
        adherenceService.getAdherenceSummary('30d').catch(() => null),
        adherenceService.getDailyAdherence(30).catch(() => []),
      ])

      setCurrentMonthLogs(logsResult.data || [])
      setTotalLogs(logsResult.total || 0)
      setAdherenceSummary(summary)
      setDailyAdherence(daily)

      if (logsResult.data?.length > 0) {
        setSelectedCalendarDate(new Date(logsResult.data[0].taken_at))
      }
    } catch (err) {
      setError('Erro ao carregar dados: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      setCurrentMonthLogs(prev => prev.filter(log => log.id !== id))
      setTotalLogs(prev => Math.max(0, prev - 1))
      refresh()
    } catch (err) {
      setError('Erro ao remover: ' + err.message)
    }
  }

  const handleEditClick = (log) => {
    setEditingLog(log)
    setIsModalOpen(true)
  }

  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  if (isLoading) return <Loading text="Carregando saúde..." />

  const score = stats?.adherenceScore ?? 0
  const streak = stats?.currentStreak ?? 0
  const bestStreak = stats?.bestStreak ?? 0
  const pillsThisMonth = currentMonthLogs.reduce((sum, log) => sum + log.quantity_taken, 0)

  return (
    <div className="health-history-view">
      {/* Header with back button */}
      <div className="health-history-header">
        <button className="health-history-header__back" onClick={() => onNavigate('profile')}>
          ← Minha Saúde
        </button>
      </div>

      {successMessage && <div className="health-history-banner health-history-banner--success">✅ {successMessage}</div>}
      {error && <div className="health-history-banner health-history-banner--error">❌ {error}</div>}

      {/* Adherence summary */}
      <div className="health-history-summary glass-card">
        <div className="health-history-summary__top">
          <div>
            <span className="health-history-summary__label">Adesão 30d</span>
            <span className="health-history-summary__score">{score}%</span>
          </div>
          {adherenceSummary?.trend && (
            <span className={`health-history-summary__trend health-history-summary__trend--${adherenceSummary.trend}`}>
              {adherenceSummary.trend === 'up' ? '↑' : adherenceSummary.trend === 'down' ? '↓' : '→'}
            </span>
          )}
        </div>
        <div className="health-history-summary__bar">
          <div className="health-history-summary__fill" style={{ width: `${Math.min(score, 100)}%` }} />
        </div>
        <div className="health-history-summary__streak">
          🔥 {streak}d streak · Melhor: {bestStreak}d
        </div>
      </div>

      {/* Calendar */}
      <div className="health-history-calendar glass-card">
        <CalendarWithMonthCache
          onLoadMonth={handleCalendarLoadMonth}
          markedDates={currentMonthLogs.map(log => log.taken_at)}
          selectedDate={selectedCalendarDate}
          onDayClick={setSelectedCalendarDate}
        />
        {dayLogs.length > 0 && (
          <div className="health-history-day-detail">
            <h4 className="health-history-day-detail__title">
              Doses de {selectedCalendarDate?.toLocaleDateString('pt-BR')}
            </h4>
            {dayLogs.map(log => (
              <div
                key={log.id}
                className="health-history-day-log"
                onClick={() => handleEditClick(log)}
              >
                <span className="health-history-day-log__name">{log.medicine?.name}</span>
                <span className="health-history-day-log__time">
                  {new Date(log.taken_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sparkline 30d */}
      {dailyAdherence.length > 0 && (
        <div className="health-history-sparkline glass-card">
          <h3 className="health-history-section-title">Sparkline 30 dias</h3>
          <SparklineAdesao data={dailyAdherence} size="expanded" />
        </div>
      )}

      {/* Timeline */}
      {sortedDates.length > 0 && (
        <div className="health-history-timeline">
          <h3 className="health-history-section-title">Timeline de Doses</h3>
          {sortedDates.slice(0, 10).map(date => (
            <div key={date} className="health-history-timeline__day">
              <div className="health-history-timeline__header">
                <span>{date}</span>
                <span className="health-history-timeline__count">
                  {groupedLogs[date].length} {groupedLogs[date].length === 1 ? 'dose' : 'doses'}
                </span>
              </div>
              <div className="health-history-timeline__logs">
                {groupedLogs[date].map(log => (
                  <LogEntry
                    key={log.id}
                    log={log}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteLog}
                  />
                ))}
              </div>
            </div>
          ))}
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
            <span className="health-history-stat__value">{sortedDates.length}</span>
            <span className="health-history-stat__label">Dias</span>
          </div>
          <div className="health-history-stat">
            <span className="health-history-stat__value">{pillsThisMonth}</span>
            <span className="health-history-stat__label">Comprimidos</span>
          </div>
        </div>
      </div>

      {/* Register dose CTA */}
      <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
        <Button variant="primary" onClick={() => { setEditingLog(null); setIsModalOpen(true) }}>
          ✅ Registrar Dose
        </Button>
      </div>

      {/* Log modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingLog(null) }}
      >
        <LogForm
          protocols={protocols}
          treatmentPlans={treatmentPlans}
          initialValues={editingLog}
          onSave={handleLogMedicine}
          onCancel={() => { setIsModalOpen(false); setEditingLog(null) }}
        />
      </Modal>
    </div>
  )
}
