import { useState, useEffect, useMemo, useRef } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import { useDoseZones, classifyDose } from '@dashboard/hooks/useDoseZones'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { getCurrentUser, supabase } from '@shared/utils/supabase'
import { getTodayLocal, getNow } from '@utils/dateUtils'
import Loading from '@shared/components/ui/Loading'
import './Dashboard.css'
import DashboardColumnLeft from './DashboardColumnLeft'
import DashboardColumnRight from './DashboardColumnRight'
import { useReminderSuggestion } from '@dashboard/hooks/useReminderSuggestion'
import { useDashboardHandlers } from '@dashboard/hooks/useDashboardHandlers'
import insightService from '@dashboard/services/insightService'
import { useTodayMeasures } from '@features/measures/hooks/useTodayMeasures'
import { formatTimePtBR } from '@dosiq/core'

/**
 * getMotivationalMessage — Mensagem contextual baseada em adesão e doses restantes
 *
 * @param {number} adherenceScore — Score de 0-100
 * @param {number} remainingDoses — Doses não registradas hoje
 * @returns {string} Mensagem motivacional
 */
function getMotivationalMessage(adherenceScore, remainingDoses) {
  if (remainingDoses === 0) {
    return '✅ Perfeito!'
  }
  if (adherenceScore >= 80) {
    return '🌟 Excelente!'
  }
  if (adherenceScore >= 50) {
    return '💪 Quase lá!'
  }
  return '🎯 Vamos retomar'
}

/** Resolve o primeiro nome do usuário a partir de settings → metadata → email */
async function resolveUserName(user, supabaseClient) {
  const { data: settings } = await supabaseClient
    .from('user_settings')
    .select('display_name')
    .eq('user_id', user.id)
    .single()
  if (settings?.display_name) return settings.display_name.split(' ')[0]
  if (user?.user_metadata?.full_name) return user.user_metadata.full_name.split(' ')[0]
  if (user?.email) return user.email.split('@')[0]
  return ''
}

/** Seleciona o insight atual baseado no estado do dashboard */
function selectCurrentInsight({ stats, stockSummary, logs, protocols, onNavigate, excludeIds = [] }) {
  if (!stats) return null
  return insightService.selectBestInsight({
    stats: {
      score: stats.score ?? 0,
      currentStreak: stats.currentStreak ?? 0,
      longestStreak: stats.longestStreak ?? 0,
      adherence: stats.adherence ?? 0,
      activeProtocols: protocols?.filter((p) => p.active)?.length ?? 0,
    },
    dailyAdherence: [],
    stockSummary: stockSummary?.items ?? [],
    logs: logs ?? [],
    onNavigate,
    excludeIds,
  })
}

/**
 * Dashboard — View principal do Santuário Terapêutico.
 * @param {Function} onNavigate — Callback de navegação (view, params?) => void
 */
function useDashboardViewState(onNavigate) {
  // ── Dados compartilhados (NÃO duplicar) ──
  const {
    stats,
    stockSummary,
    protocols,
    logs,
    refresh,
    isLoading: contextLoading,
  } = useDashboard()
  const { zones, totals, carryOver, lookAhead, todayDoses, now, nowRaw } = useDoseZones()
  const { mode: complexityMode } = useComplexityMode()

  // ── Estado local ──
  const [userName, setUserName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const currentDateRef = useRef(getTodayLocal())
  const [dismissedSuggestionId, setDismissedSuggestionId] = useState(null)
  const [dismissedInsightIds, setDismissedInsightIds] = useState([])

  // ── Custom Hooks ──
  const reminderSuggestionData = useReminderSuggestion(protocols, logs, dismissedSuggestionId)
  const {
    handleRegisterDoseQuick,
    handleRegisterDosesAll,
    handleReminderAccept,
    actionError,
    clearActionError,
  } = useDashboardHandlers({
    refresh,
    reminderSuggestionData,
    protocols,
    setDismissedSuggestionId,
  })

  // ── Computadas ──
  const stockByMedicineId = useMemo(() => {
    const map = new Map()
    stockSummary?.items?.forEach((item) => map.set(item.medicineId, item))
    return map
  }, [stockSummary])

  const scheduleAllDoses = useMemo(() => {
    return todayDoses.map((dose) => ({
      ...dose,
      stockDays: stockByMedicineId.get(dose.medicineId)?.daysRemaining ?? null,
      stockStatus: stockByMedicineId.get(dose.medicineId)?.stockStatus ?? null,
    }))
  }, [todayDoses, stockByMedicineId])

  const carryOverDoses = useMemo(() => {
    return (carryOver || []).map((dose) => ({
      ...dose,
      stockDays: stockByMedicineId.get(dose.medicineId)?.daysRemaining ?? null,
      stockStatus: stockByMedicineId.get(dose.medicineId)?.stockStatus ?? null,
    }))
  }, [carryOver, stockByMedicineId])

  const lookAheadDoses = useMemo(() => {
    return (lookAhead || []).map((dose) => ({
      ...dose,
      stockDays: stockByMedicineId.get(dose.medicineId)?.daysRemaining ?? null,
      stockStatus: stockByMedicineId.get(dose.medicineId)?.stockStatus ?? null,
    }))
  }, [lookAhead, stockByMedicineId])

  const urgentDoses = useMemo(() => {
    const aheadImminent = (lookAhead || []).filter(
      (d) => classifyDose(d.scheduledFor, nowRaw, 120, 60, 240, false, d.toleranceMinutes) === 'now'
    )
    return [
      ...(carryOver || []).filter((d) => !d.isRegistered).map((d) => ({ ...d, zone: 'late' })),
      ...(zones.late || []).filter((d) => !d.isRegistered).map((d) => ({ ...d, zone: 'late' })),
      ...(zones.now || []).filter((d) => !d.isRegistered).map((d) => ({ ...d, zone: 'now' })),
      ...aheadImminent.map((d) => ({ ...d, zone: 'now' })),
    ].sort((a, b) => (a.scheduledFor || '').localeCompare(b.scheduledFor || ''))
  }, [carryOver, zones, lookAhead, nowRaw])

  const criticalStockItems = useMemo(() => {
    if (!stockSummary?.items) return []
    return stockSummary.items.filter(
      (item) => item.stockStatus === 'critical' || item.stockStatus === 'low'
    )
  }, [stockSummary])

  const currentInsight = useMemo(
    () => selectCurrentInsight({ stats, stockSummary, logs, protocols, onNavigate, excludeIds: dismissedInsightIds }),
    [stats, stockSummary, logs, protocols, onNavigate, dismissedInsightIds]
  )

  const handleDismissInsight = (insightId) => {
    setDismissedInsightIds((prev) => [...prev, insightId])
  }

  // ── Effects ──
  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        if (!user) return
        setUserName(await resolveUserName(user, supabase))
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      const currentDate = getTodayLocal()
      if (currentDate !== currentDateRef.current) {
        currentDateRef.current = currentDate
        refresh()
      }
    }, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  return {
    stats,
    stockSummary,
    protocols,
    logs,
    refresh,
    contextLoading,
    zones,
    totals,
    carryOver,
    lookAhead,
    todayDoses,
    now,
    nowRaw,
    complexityMode,
    userName,
    isLoading,
    currentDateRef,
    dismissedSuggestionId,
    scheduleAllDoses,
    carryOverDoses,
    lookAheadDoses,
    urgentDoses,
    criticalStockItems,
    currentInsight,
    handleDismissInsight,
    reminderSuggestionData,
    handleRegisterDoseQuick,
    handleRegisterDosesAll,
    handleReminderAccept,
    actionError,
    clearActionError,
    setDismissedSuggestionId,
  }
}

export default function Dashboard({ onNavigate }) {
  const {
    stats,
    contextLoading,
    complexityMode,
    userName,
    isLoading,
    scheduleAllDoses,
    carryOverDoses,
    lookAheadDoses,
    urgentDoses,
    criticalStockItems,
    currentInsight,
    handleDismissInsight,
    reminderSuggestionData,
    handleRegisterDoseQuick,
    handleRegisterDosesAll,
    handleReminderAccept,
    actionError,
    clearActionError,
    setDismissedSuggestionId,
    totals,
    now,
    nowRaw,
  } = useDashboardViewState(onNavigate)

  // ── Medidas (012 Fase C / FR-011): interleave na agenda + card "Última medida" do dia ──
  const { items: todayMeasures, latest: lastMeasure } = useTodayMeasures()
  // Itens de medida no shape da timeline (kind='measure'): horário local p/ ordenação/agrupamento.
  const measureItems = useMemo(
    () => (todayMeasures || []).map((m) => ({
      kind: 'measure', id: m.id, scheduledTime: formatTimePtBR(m.measured_at), scheduledFor: m.measured_at, measure: m,
    })),
    [todayMeasures]
  )

  const handleOpenMeasureHistory = (type) => onNavigate?.('history', { measureType: type })
  // Registro de medida = speed-dial global (App). Nudge do card vazio pede a abertura via evento.
  const handleRegisterMeasure = () => window.dispatchEvent(new CustomEvent('mr:open-measure-log'))

  // ── Loading state ──
  if (isLoading || contextLoading) {
    return (
      <div className="dashboard-loading-wrap">
        <Loading text="Carregando..." />
      </div>
    )
  }

  const adherenceScore = stats?.score ?? 0
  const streak = stats?.currentStreak ?? 0
  const today = getNow().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      className="page-container dashboard-container"
      aria-label="Dashboard — Dosiq"
    >
      {/* Erro de ação 1-click (Tomar/Confirmar agora) — ex.: estoque insuficiente.
          Antes o throw morria sem consumidor e o clique parecia ignorado (smoke PO). */}
      {actionError && (
        <div className="dashboard-action-error" role="alert">
          <span>⚠️ {actionError}</span>
          <button
            type="button"
            className="dashboard-action-error__close"
            onClick={clearActionError}
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── 2-Column Grid: Left (Ring + Greeting + Priority) | Right (Schedule + Stock + Empty) ─── */}
      <div className="grid-dashboard">
        {/* ═══ LEFT COLUMN (1fr) ═══ */}
        <DashboardColumnLeft
          userName={userName}
          adherenceScore={adherenceScore}
          totals={totals}
          streak={streak}
          getMotivationalMessage={getMotivationalMessage}
          urgentDoses={urgentDoses}
          handleRegisterDoseQuick={handleRegisterDoseQuick}
          handleRegisterDosesAll={handleRegisterDosesAll}
          currentInsight={currentInsight}
          onDismissInsight={handleDismissInsight}
          onNavigate={onNavigate}
          reminderSuggestionData={reminderSuggestionData}
          handleReminderAccept={handleReminderAccept}
          setDismissedSuggestionId={setDismissedSuggestionId}
        />

        {/* ═══ RIGHT COLUMN (2fr) ═══ */}
        <DashboardColumnRight
          scheduleAllDoses={scheduleAllDoses}
          carryOverDoses={carryOverDoses}
          lookAheadDoses={lookAheadDoses}
          today={today}
          handleRegisterDoseQuick={handleRegisterDoseQuick}
          complexityMode={complexityMode}
          now={now}
          nowRaw={nowRaw}
          contextLoading={contextLoading}
          onNavigate={onNavigate}
          criticalStockItems={criticalStockItems}
          measureItems={measureItems}
          lastMeasure={lastMeasure}
          onOpenMeasureHistory={handleOpenMeasureHistory}
          onRegisterMeasure={handleRegisterMeasure}
        />
      </div>
    </div>
  )
}
