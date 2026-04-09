import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { cachedLogService as logService } from '@shared/services'
import { analyticsService } from '@dashboard/services/analyticsService'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import {
  useDoseZones,
  expandProtocolsToDoses,
  filterTodayLogs,
} from '@dashboard/hooks/useDoseZones'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { getCurrentUser, supabase } from '@shared/utils/supabase'
import { getTodayLocal } from '@utils/dateUtils'
import Loading from '@shared/components/ui/Loading'
import './Dashboard.css'
import RingGaugeRedesign from '@dashboard/components/RingGaugeRedesign'
import PriorityDoseCard from '@dashboard/components/PriorityDoseCard'
import CronogramaPeriodo from '@dashboard/components/CronogramaPeriodo'
import StockAlertInline from '@dashboard/components/StockAlertInline'
import SmartAlertsRedesign from '@dashboard/components/SmartAlertsRedesign'
import InsightCardRedesign from '@dashboard/components/InsightCardRedesign'
import ReminderSuggestionRedesign from '@features/protocols/components/ReminderSuggestionRedesign'
import {
  analyzeReminderTiming,
  isSuggestionDismissed,
  dismissSuggestion,
} from '@features/protocols/services/reminderOptimizerService'
import insightService from '@dashboard/services/insightService'
import { protocolService } from '@features/protocols/services/protocolService'

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
export default function DashboardRedesign({ onNavigate }) {
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
  const smartAlerts = useMemo(() => {
    const alerts = []

    // 1. Stock alerts
    stockSummary?.items?.forEach((item) => {
      if (snoozedAlerts[`stock-${item.medicineId}`]) return
      if (item.stockStatus === 'critical' || item.stockStatus === 'low') {
        const severity = item.stockStatus === 'critical' ? 'critical' : 'warning'
        alerts.push({
          id: `stock-${item.medicineId}`,
          severity,
          title:
            severity === 'critical'
              ? `Estoque crítico — ${item.medicineName}`
              : `Estoque baixo — ${item.medicineName}`,
          message:
            severity === 'critical'
              ? `${item.quantity ?? 0} unidades restantes. Reposição urgente.`
              : `${item.daysRemaining} dias restantes. Programe a compra.`,
          actions: [{ label: 'Registrar Compra', type: 'primary' }],
        })
      }
    })

    // 2. Doses atrasadas (zones.late)
    const lateDoses = (zones.late || []).filter((d) => !d.isRegistered)
    if (lateDoses.length > 0 && !snoozedAlerts['late-doses']) {
      const names = lateDoses
        .slice(0, 2)
        .map((d) => d.medicineName)
        .join(', ')
      const extra = lateDoses.length > 2 ? ` +${lateDoses.length - 2}` : ''
      alerts.push({
        id: 'late-doses',
        severity: 'warning',
        title: `${lateDoses.length} dose${lateDoses.length > 1 ? 's' : ''} atrasada${lateDoses.length > 1 ? 's' : ''}`,
        message: `${names}${extra} — registre agora para manter sua adesão.`,
        actions: [{ label: 'Registrar Agora', type: 'primary' }],
      })
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 }
      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2)
    })
  }, [stockSummary, zones, snoozedAlerts])

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

  // ── Sugestão de lembrete calculada (sem setState em effect) ──
  // isSuggestionDismissed e analyzeReminderTiming são funções estáveis importadas (não reativas)
  const reminderSuggestionData = (() => {
    if (!protocols?.length || !logs?.length) return null
    for (const protocol of protocols) {
      if (!protocol.active) continue
      if (protocol.id === dismissedSuggestionId) continue
      if (isSuggestionDismissed(protocol.id)) continue
      const suggestion = analyzeReminderTiming({ protocol, logs })
      if (suggestion?.shouldSuggest) {
        return {
          suggestion,
          protocolId: protocol.id,
          protocolName: protocol.medicine?.name || protocol.name || '',
        }
      }
    }
    return null
  })()

  // ── Handlers ──
  // Registra dose DIRETAMENTE sem modal (1-click experience)
  const handleRegisterDoseQuick = useCallback(
    async (medicineId, protocolId, dosagePerIntake) => {
      try {
        await logService.create({
          medicine_id: medicineId,
          protocol_id: protocolId,
          quantity_taken: dosagePerIntake,
          taken_at: new Date().toISOString(),
        })
        analyticsService.track('dose_registered_quick', {
          timestamp: Date.now(),
          method: 'priority-card',
        })
        refresh()
      } catch (err) {
        console.error('Erro ao registrar dose:', err)
        alert('Erro ao registrar dose. Tente novamente.')
      }
    },
    [refresh]
  )

  // Registra múltiplas doses em batch (PriorityDoseCard com 2+ doses)
  const handleRegisterDosesAll = useCallback(
    async (doses) => {
      if (!doses || doses.length === 0) return
      try {
        for (const dose of doses) {
          await logService.create({
            medicine_id: dose.medicineId,
            protocol_id: dose.protocolId,
            quantity_taken: dose.dosagePerIntake,
            taken_at: new Date().toISOString(),
          })
        }
        analyticsService.track('doses_registered_batch', {
          timestamp: Date.now(),
          method: 'priority-card',
          count: doses.length,
        })
        refresh()
      } catch (err) {
        console.error('Erro ao registrar doses:', err)
        alert('Erro ao registrar doses. Tente novamente.')
      }
    },
    [refresh]
  )

  const handleSnoozeAlert = useCallback((alertId) => {
    setSnoozedAlerts((prev) => ({ ...prev, [alertId]: true }))
  }, [])

  const handleReminderAccept = useCallback(
    async (newTime) => {
      const protocolId = reminderSuggestionData?.protocolId
      const currentTime = reminderSuggestionData?.suggestion?.currentTime
      if (protocolId && newTime && currentTime) {
        // Atualiza time_schedule: substitui horário antigo pelo sugerido
        const protocol = protocols?.find((p) => p.id === protocolId)
        const currentSchedule = protocol?.time_schedule ?? []
        const updatedSchedule = currentSchedule.map((t) => (t === currentTime ? newTime : t))
        // Se o horário antigo não estava no array (edge case), adiciona o novo
        const finalSchedule = updatedSchedule.includes(newTime)
          ? updatedSchedule
          : [...updatedSchedule, newTime]
        try {
          await protocolService.update(protocolId, { time_schedule: finalSchedule })
        } catch (err) {
          console.error('[DashboardRedesign] Erro ao atualizar horário do protocolo:', err)
        }
      }
      if (protocolId) {
        // Persiste dispensa no localStorage (30 dias) para sobreviver ao reload
        dismissSuggestion(protocolId, false)
        setDismissedSuggestionId(protocolId)
      }
      refresh()
    },
    [refresh, reminderSuggestionData, protocols]
  )

  // ── Loading state ──
  if (isLoading || contextLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <Loading text="Carregando..." />
      </div>
    )
  }

  const adherenceScore = stats?.score ?? 0
  const streak = stats?.currentStreak ?? 0
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      className="page-container"
      style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}
      aria-label="Dashboard — Meus Remédios"
    >
      {/* ─── Smart Alerts (substitui StockAlertInline no topo) ─── */}
      {smartAlerts.length > 0 && (
        <section style={{ marginBottom: '1.25rem' }} aria-label="Alertas inteligentes">
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            alignItems: 'center',
          }}
        >
          {/* Header + Ring de Adesão */}
          <div className="dr-badge">
            <div className="dr-badge__text">
              <h1
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display, Public Sans, sans-serif)',
                  fontSize: 'var(--text-headline-md, 1.75rem)',
                  fontWeight: '700',
                  color: 'var(--color-on-surface, #191c1d)',
                  lineHeight: 1.2,
                }}
              >
                {userName ? `Olá, ${userName} 👋` : 'Olá! 👋'}
              </h1>

              <p
                style={{
                  margin: '0.25rem 0 0',
                  fontFamily: 'var(--font-body, Lexend, sans-serif)',
                  fontSize: 'var(--text-label-md, 0.75rem)',
                  color: 'var(--color-outline, #6d7a76)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: '600',
                }}
              >
                ADESÃO DIÁRIA
              </p>

              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontFamily: 'var(--font-body, Lexend, sans-serif)',
                  fontSize: 'var(--text-body-lg, 1rem)',
                  color: 'var(--color-on-surface-variant, #3e4946)',
                }}
              >
                {getMotivationalMessage(adherenceScore, totals.remaining)}
              </p>
            </div>

            <RingGaugeRedesign score={adherenceScore} streak={streak} size="large" />
          </div>

          {/* Priority Dose Card — 1-Click Registration */}
          {urgentDoses.length > 0 && (
            <div style={{ width: '100%' }}>
              <PriorityDoseCard
                doses={urgentDoses}
                onRegister={(dose) =>
                  handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake)
                }
                onRegisterAll={handleRegisterDosesAll}
                variant="priority"
              />
            </div>
          )}

          {/* 🆕 Insight Card — coluna esquerda, sob o PriorityDoseCard */}
          {currentInsight && (
            <div style={{ width: '100%' }}>
              <InsightCardRedesign
                insight={currentInsight}
                onAction={(insight) => {
                  if (insight.action?.navigate) onNavigate?.(insight.action.navigate)
                }}
                onDismiss={() => {}}
              />
            </div>
          )}

          {/* 🆕 Reminder Suggestion — coluna esquerda, sob o InsightCard */}
          {reminderSuggestionData && (
            <div style={{ width: '100%' }}>
              <ReminderSuggestionRedesign
                suggestion={reminderSuggestionData.suggestion}
                protocolId={reminderSuggestionData.protocolId}
                protocolName={reminderSuggestionData.protocolName}
                onAccept={handleReminderAccept}
                onDismiss={() => setDismissedSuggestionId(reminderSuggestionData.protocolId)}
              />
            </div>
          )}
        </div>

        {/* ═══ RIGHT COLUMN (2fr) ═══ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Cronograma do Dia */}
          {scheduleAllDoses.length > 0 && (
            <section aria-label="Cronograma de hoje">
              <div style={{ marginBottom: '1rem' }}>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-display, Public Sans, sans-serif)',
                    fontSize: 'var(--text-title-lg, 1.125rem)',
                    fontWeight: '600',
                    color: 'var(--color-on-surface, #191c1d)',
                  }}
                >
                  Cronograma de Hoje
                </h2>
                <p
                  style={{
                    margin: '0.25rem 0 0',
                    fontFamily: 'var(--font-body, Lexend, sans-serif)',
                    fontSize: 'var(--text-label-md, 0.75rem)',
                    color: 'var(--color-outline, #6d7a76)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: '600',
                  }}
                >
                  {today}
                </p>
              </div>
              <CronogramaPeriodo
                allDoses={scheduleAllDoses}
                onRegister={(dose) =>
                  handleRegisterDoseQuick(dose.medicineId, dose.protocolId, dose.dosagePerIntake)
                }
                variant={complexityMode === 'simple' ? 'simple' : 'complex'}
                now={now}
              />
            </section>
          )}

          {/* Empty State */}
          {scheduleAllDoses.length === 0 && !contextLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: 'var(--color-outline, #6d7a76)',
              }}
              role="status"
            >
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💊</p>
              <p
                style={{
                  fontFamily: 'var(--font-body, Lexend, sans-serif)',
                  fontSize: 'var(--text-body-lg, 1rem)',
                }}
              >
                Nenhuma dose agendada para hoje.
              </p>
              <button
                onClick={() => onNavigate?.('medicines')}
                style={{
                  marginTop: '1rem',
                  padding: '0.625rem 1.125rem',
                  minHeight: '3.5rem',
                  background: 'var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577))',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-button, 1.25rem)',
                  fontFamily: 'var(--font-body, Lexend, sans-serif)',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Adicionar Medicamento
              </button>
            </div>
          )}

          {/* Stock Alert (Simple Mode: Bottom) */}
          {complexityMode !== 'complex' && criticalStockItems.length > 0 && (
            <section style={{ marginTop: 'auto' }} aria-label="Alertas de estoque">
              <StockAlertInline
                criticalItems={criticalStockItems}
                onNavigateToStock={() => onNavigate?.('stock')}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
