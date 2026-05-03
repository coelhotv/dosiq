import { useState, useEffect, useMemo, useRef } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import {
  useDoseZones,
  expandProtocolsToDoses,
  filterTodayLogs,
} from '@dashboard/hooks/useDoseZones'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { getCurrentUser, supabase } from '@shared/utils/supabase'
import { getTodayLocal, getNow } from '@utils/dateUtils'
import Loading from '@shared/components/ui/Loading'
import './Dashboard.css'
import DashboardColumnLeft from './DashboardColumnLeft'
import DashboardColumnRight from './DashboardColumnRight'
import SmartAlertsRedesign from '@dashboard/components/SmartAlertsRedesign'
import { useSmartAlerts } from '@dashboard/hooks/useSmartAlerts'
import { useReminderSuggestion } from '@dashboard/hooks/useReminderSuggestion'
import { useDashboardHandlers } from '@dashboard/hooks/useDashboardHandlers'
import insightService from '@dashboard/services/insightService'

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

/**
 * DashboardRedesign — View principal do Santuário Terapêutico.
 *
 * Compartilha TODA a lógica de dados com Dashboard.jsx.
 * Diferença: apenas a camada de apresentação.
 *
 * @param {Function} onNavigate — Callback de navegação (view, params?) => void
 */
export default function Dashboard({ onNavigate }) {
  // ── Dados compartilhados (NÃO duplicar) ──
  const {
    stats,
    stockSummary,
    protocols,
    logs,
    refresh,
    isLoading: contextLoading,
  } = useDashboard()
  const { zones, totals, now } = useDoseZones()
  const { mode: complexityMode } = useComplexityMode()

  // ── Estado local ──
  const [userName, setUserName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const currentDateRef = useRef(getTodayLocal())
  const [dismissedSuggestionId, setDismissedSuggestionId] = useState(null)
  const [snoozedAlerts, setSnoozedAlerts] = useState({})

  // ── Computadas ──
  // Enriquecer doses com dados de estoque
  const stockByMedicineId = useMemo(() => {
    const map = new Map()
    stockSummary?.items?.forEach((item) => map.set(item.medicineId, item))
    return map
  }, [stockSummary])

  // scheduleAllDoses: fonte separada para CronogramaPeriodo — todos os protocolos expandidos (sem filtro classifyDose)
  const scheduleAllDoses = useMemo(() => {
    if (!protocols?.length) return []
    const todayLogs = filterTodayLogs(logs || [])
    return expandProtocolsToDoses(protocols, todayLogs).map((dose) => ({
      ...dose,
      stockDays: stockByMedicineId.get(dose.medicineId)?.daysRemaining ?? null,
      stockStatus: stockByMedicineId.get(dose.medicineId)?.stockStatus ?? null,
    }))
  }, [protocols, logs, stockByMedicineId])

  // urgentDoses: fonte separada para PriorityDoseCard — zonas late/now filtradas
  const urgentDoses = useMemo(
    () => [
      ...(zones.late || []).filter((d) => !d.isRegistered),
      ...(zones.now || []).filter((d) => !d.isRegistered),
    ],
    [zones]
  )

  const criticalStockItems = useMemo(() => {
    if (!stockSummary?.items) return []
    return stockSummary.items.filter(
      (item) => item.stockStatus === 'critical' || item.stockStatus === 'low'
    )
  }, [stockSummary])

  // ── smartAlerts: alertas inteligentes (estoque + dose atrasada + prescrição) ──
  const smartAlerts = useSmartAlerts(stockSummary, zones, snoozedAlerts)

  // ── currentInsight: insight rotativo do insightService ──
  const currentInsight = useMemo(() => {
    if (!stats) return null
    const insight = insightService.selectBestInsight({
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
    })
    return insight
  }, [stats, stockSummary, logs, protocols, onNavigate])

  // ── Carregar nome do usuário ──
  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        if (!user) return

        // 1. Prioridade: display_name do perfil (user_settings)
        const { data: settings } = await supabase
          .from('user_settings')
          .select('display_name')
          .eq('user_id', user.id)
          .single()

        if (settings?.display_name) {
          setUserName(settings.display_name.split(' ')[0])
        } else if (user?.user_metadata?.full_name) {
          // 2. Fallback: nome do auth metadata
          setUserName(user.user_metadata.full_name.split(' ')[0])
        } else if (user?.email) {
          // 3. Fallback: prefixo do email
          setUserName(user.email.split('@')[0])
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // ── Refresh automático ao virar o dia (timezone local) ──
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

  // ── Sugestão de lembrete calculada (Onda 2: hook customizado) ──
  const reminderSuggestionData = useReminderSuggestion(protocols, logs, dismissedSuggestionId)

  // ── Handlers (Onda 2: hook customizado) ──
  const {
    handleRegisterDoseQuick,
    handleRegisterDosesAll,
    handleSnoozeAlert,
    handleReminderAccept,
  } = useDashboardHandlers({
    refresh,
    reminderSuggestionData,
    protocols,
    setSnoozedAlerts,
    setDismissedSuggestionId,
  })

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
      {/* ─── Smart Alerts (substitui StockAlertInline no topo) ─── */}
      {smartAlerts.length > 0 && (
        <section className="dashboard-alerts-section" aria-label="Alertas inteligentes">
          <SmartAlertsRedesign
            alerts={smartAlerts}
            onAction={(alert, action) => {
              if (action.label === 'Registrar Compra') onNavigate?.('stock')
              if (action.label === 'Registrar Agora') onNavigate?.('dashboard')
            }}
            isComplex={complexityMode !== 'simple'}
            onSnooze={handleSnoozeAlert}
          />
        </section>
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
          onNavigate={onNavigate}
          reminderSuggestionData={reminderSuggestionData}
          handleReminderAccept={handleReminderAccept}
          setDismissedSuggestionId={setDismissedSuggestionId}
        />

        {/* ═══ RIGHT COLUMN (2fr) ═══ */}
        <DashboardColumnRight
          scheduleAllDoses={scheduleAllDoses}
          today={today}
          handleRegisterDoseQuick={handleRegisterDoseQuick}
          complexityMode={complexityMode}
          now={now}
          contextLoading={contextLoading}
          onNavigate={onNavigate}
          criticalStockItems={criticalStockItems}
        />
      </div>
    </div>
  )
}
