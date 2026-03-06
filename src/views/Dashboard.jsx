import { useState, useEffect, useMemo } from 'react'
import {
  cachedLogService as logService,
  cachedTreatmentPlanService as treatmentPlanService,
  adherenceService,
} from '@shared/services'
import { getExpiringPrescriptions, PRESCRIPTION_STATUS } from '@features/prescriptions/services/prescriptionService'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import HealthScoreCard from '@dashboard/components/HealthScoreCard'
import HealthScoreDetails from '@dashboard/components/HealthScoreDetails'
import SmartAlerts from '@dashboard/components/SmartAlerts'
import InsightCard from '@dashboard/components/InsightCard'
import TreatmentAccordion from '@dashboard/components/TreatmentAccordion'
import SwipeRegisterItem from '@dashboard/components/SwipeRegisterItem'
import SparklineAdesao from '@dashboard/components/SparklineAdesao'
import DailyDoseModal from '@dashboard/components/DailyDoseModal'
import LastDosesWidget from '@dashboard/components/LastDosesWidget'
import EmptyState from '@shared/components/ui/EmptyState'
import ThemeToggle from '@shared/components/ui/ThemeToggle'
import ConfettiAnimation from '@shared/components/ui/animations/ConfettiAnimation'
import MilestoneCelebration from '@shared/components/gamification/MilestoneCelebration'
import ReportGenerator from '@features/reports/components/ReportGenerator'
import { checkNewMilestones } from '@dashboard/services/milestoneService'
import { analyticsService } from '@dashboard/services/analyticsService'
import { getCurrentUser } from '@shared/utils/supabase'
import { useInsights } from '@dashboard/hooks/useInsights'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'
import RingGauge from '@dashboard/components/RingGauge'
import StockBars from '@dashboard/components/StockBars'
import DoseZoneList from '@dashboard/components/DoseZoneList'
import AdaptiveLayout from '@dashboard/components/AdaptiveLayout'
import ViewModeToggle from '@dashboard/components/ViewModeToggle'
import { useDoseZones } from '@dashboard/hooks/useDoseZones'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import styles from './Dashboard.module.css'

// Constante para chave de armazenamento de alertas snoozed
const SNOOZE_STORAGE_KEY = 'mr_snoozed_alerts'
const SNOOZE_DURATION_MS = 4 * 60 * 60 * 1000 // 4 horas

/**
 * Dashboard "Health Command Center"
 * Implementação da Onda 2.5 com UI Cyberpunk/Neo-Glass.
 */
export default function Dashboard({ onNavigate }) {
  const {
    stats,
    protocols: rawProtocols,
    logs,
    stockSummary,
    refresh,
    isDoseInToleranceWindow,
    isLoading: contextLoading,
  } = useDashboard()
  const [userName, setUserName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [_error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [prefillData, setPrefillData] = useState(null)
  const [rawTreatmentPlans, setRawTreatmentPlans] = useState([])

  // Dados de adesão para Sparkline
  const [dailyAdherence, setDailyAdherence] = useState([])
  const [isAdherenceLoading, setIsAdherenceLoading] = useState(true)

  const [isHealthDetailsOpen, setIsHealthDetailsOpen] = useState(false)

  // Rastreamentos de alertas silenciados (snoozed) pelo usuário - declarado antes do useMemo que o utiliza
  // Estrutura: Map<alertId, { snoozedAt: timestamp, expiresAt: timestamp, scheduledTime: string }>
  const [snoozedAlerts, setSnoozedAlerts] = useState(() => {
    try {
      const data = localStorage.getItem(SNOOZE_STORAGE_KEY)
      if (!data) return new Map()

      const parsed = JSON.parse(data)
      const map = new Map()
      const now = Date.now()

      // Limpar expirados ao carregar
      parsed.forEach(([id, value]) => {
        if (value.expiresAt > now) {
          map.set(id, value)
        }
      })

      return map
    } catch {
      return new Map()
    }
  })

  // Wave 2 — zonas temporais de doses e complexidade progressiva (W2-01, W2-02, W2-10)
  const { zones, totals } = useDoseZones()
  const { mode: complexityMode, defaultViewMode, ringGaugeSize } = useComplexityMode()
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('mr_view_mode') || defaultViewMode)
  const [selectedDoseKeys, setSelectedDoseKeys] = useState(new Set())

  // Dados de insight
  const { insight, loading: insightLoading } = useInsights({
    stats,
    dailyAdherence,
    stockSummary,
    logs,
    onNavigate,
  })

  // DEBUG: Log insight data received from hook
  console.log('[Dashboard] Insight data received:', {
    insight,
    insightLoading,
    stats,
    dailyAdherence: dailyAdherence?.length || 0,
    stockSummary: stockSummary?.length || 0,
    logs: logs?.length || 0,
  })

  // Estado para controle de animação de confete
  const [showConfetti, setShowConfetti] = useState(false)

  // Estados para controle de celebração de milestones
  const [currentMilestone, setCurrentMilestone] = useState(null)
  const [showMilestoneCelebration, setShowMilestoneCelebration] = useState(false)

  // Estado para controle do modal de relatórios
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  // === NOVOS ESTADOS PARA DRILL-DOWN DO SPARKLINE ===
  /**
   * Data selecionada no sparkline
   * @type {string | null} - Formato 'YYYY-MM-DD'
   */
  const [selectedDate, setSelectedDate] = useState(null)

  /**
   * Controle de abertura do modal de drill-down
   * @type {boolean}
   */
  const [isDrillDownModalOpen, setIsDrillDownModalOpen] = useState(false)

  // Fetch dos logs do dia selecionado usando cache
  // Usar uma key fixa que muda apenas quando selectedDate muda
  const drillDownCacheKey = useMemo(() => {
    return selectedDate ? `logs-drilldown-${selectedDate}` : null
  }, [selectedDate])

  const {
    data: dayLogsData,
    isLoading: isDayLogsLoading,
    error: dayLogsError,
    executeQuery: refetchDayLogs,
  } = useCachedQuery(
    drillDownCacheKey,
    async () => {
      if (!selectedDate) return { data: [], total: 0, hasMore: false }

      // Garantir que a data está no formato correto (YYYY-MM-DD)
      const formattedDate = selectedDate.split('T')[0]

      // logService.getByDateRange retorna { data, total, hasMore }
      const result = await logService.getByDateRange(formattedDate, formattedDate, 50)
      return result
    },
    {
      enabled: !!selectedDate && selectedDate.length === 10,
      staleTime: 60000, // 1 minuto
      onError: (err) => {
        console.error('Erro ao carregar logs do dia:', err)
        analyticsService.track('drilldown_error', {
          error: err.message,
          date: selectedDate,
        })
      },
    }
  )

  // Handler para click em um dia do sparkline
  const handleDayClick = useMemo(
    () => (dayData) => {
      setSelectedDate(dayData.date)
      setIsDrillDownModalOpen(true)
      analyticsService.track('sparkline_drilldown_opened', {
        date: dayData.date,
        adherence: dayData.adherence,
        taken: dayData.taken,
        expected: dayData.expected,
      })
    },
    []
  )

  // Handler para fechar o modal de drill-down
  const handleCloseDrillDown = () => {
    setIsDrillDownModalOpen(false)
    // Aguardar animação de fechamento antes de limpar data
    setTimeout(() => {
      setSelectedDate(null)
    }, 300)
  }

  // Handler para retry em caso de erro
  const handleRetryDayLogs = () => {
    refetchDayLogs({ force: true })
  }

  // Extrair array de logs do resultado paginado
  const dayLogs = dayLogsData?.data || []

  // Obter resumo do dia selecionado
  const selectedDaySummary = useMemo(() => {
    if (!selectedDate || !dailyAdherence.length) return null
    return dailyAdherence.find((d) => d.date === selectedDate)
  }, [selectedDate, dailyAdherence])

  // 1. Carregar Nome do Usuário e Planos de Tratamento

  // 1. Carregar Nome do Usuário e Planos de Tratamento
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [user, plans] = await Promise.all([getCurrentUser(), treatmentPlanService.getAll()])

        if (user) {
          const name = user.user_metadata?.full_name || user.email.split('@')[0]
          setUserName(name.charAt(0).toUpperCase() + name.slice(1))
        }
        setRawTreatmentPlans(plans)
      } catch (err) {
        console.error(err)
        setError('Erro ao carregar perfil.')
      } finally {
        setIsLoading(false)
      }
    }
    loadInitialData()
  }, [])

  // Sincronizar viewMode com defaultViewMode quando não há preferência salva pelo usuário
  useEffect(() => {
    if (!localStorage.getItem('mr_view_mode')) {
      setViewMode(defaultViewMode)
    }
  }, [defaultViewMode])

  // Carregar dados de adesão para Sparkline
  useEffect(() => {
    async function loadAdherence() {
      try {
        const data = await adherenceService.getDailyAdherence(7)
        setDailyAdherence(data)
      } catch (err) {
        console.error('Erro ao carregar dados de adesão:', err)
      } finally {
        setIsAdherenceLoading(false)
      }
    }
    loadAdherence()
  }, [])

  // Persistir snoozedAlerts no localStorage
  useEffect(() => {
    const array = Array.from(snoozedAlerts.entries())
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(array))
  }, [snoozedAlerts])

  // Limpeza periódica de alertas expirados
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()

      setSnoozedAlerts((prev) => {
        const cleaned = new Map()
        prev.forEach((value, key) => {
          if (value.expiresAt > now) {
            cleaned.set(key, value)
          }
        })
        return cleaned
      })
    }, 60 * 1000) // Verificar a cada minuto

    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    analyticsService.track('page_view', { page: 'dashboard' })
  }, [])

  // Dispara confete quando atinge 100% de adesão
  useEffect(() => {
    if (stats.adherence === 100 && !showConfetti) {
      setShowConfetti(true)
      analyticsService.track('confetti_triggered', { adherence: 100 })
    }
  }, [stats.adherence, showConfetti])

  // Verificar novos milestones conquistados
  useEffect(() => {
    if (stats) {
      const newMilestones = checkNewMilestones(stats)
      if (newMilestones.length > 0) {
        // Mostrar o primeiro milestone conquistado
        setCurrentMilestone(newMilestones[0])
        setShowMilestoneCelebration(true)
      }
    }
  }, [stats])

  // 2. Injetar dados de próxima dose nos planos de tratamento
  const treatmentPlans = useMemo(() => {
    return rawTreatmentPlans.map((plan) => ({
      ...plan,
      protocols: plan.protocols?.map((p) => {
        const liveProtocol = rawProtocols.find((rp) => rp.id === p.id)
        return liveProtocol || p
      }),
    }))
  }, [rawTreatmentPlans, rawProtocols])

  // StockBars items — mapeia stockSummary para formato do componente (W2-09)
  const stockBarsItems = useMemo(
    () =>
      (stockSummary || []).map((s) => ({
        medicineId: s.medicine?.id,
        name: s.medicine?.name || 'Desconhecido',
        currentStock: s.total || 0,
        dailyConsumption: s.dailyIntake || 0,
        daysRemaining: s.daysRemaining || 0,
        level: s.isZero ? 'critical' : s.isLow ? 'low' : s.daysRemaining >= 30 ? 'high' : 'normal',
      })),
    [stockSummary]
  )

  // 2. Saudação Dinâmica baseada no horário
  const getGreeting = () => {
    const hours = new Date().getHours()
    if (hours >= 0 && hours < 6) return 'BOA MADRUGADA,'
    if (hours >= 6 && hours < 12) return 'BOM DIA,'
    if (hours >= 12 && hours < 18) return 'BOA TARDE,'
    return 'BOA NOITE,'
  }

  // 3. Orquestração de Alertas Inteligentes
  const smartAlerts = useMemo(() => {
    const alerts = []
    const now = new Date()
    const nowTimestamp = now.getTime()

    // Limpar alertas expirados do Map
    const validSnoozedAlerts = new Map()
    snoozedAlerts.forEach((value, key) => {
      if (value.expiresAt > nowTimestamp) {
        validSnoozedAlerts.set(key, value)
      }
    })

    // Atualizar estado se houve limpeza
    if (validSnoozedAlerts.size !== snoozedAlerts.size) {
      setSnoozedAlerts(validSnoozedAlerts)
    }

    // Alerta de Estoque Crítico e Baixo
    // Agregação consolidada: stockSummary já contém um item por medicamento.
    // Garantimos que cada medicine_id tenha apenas UM alerta, priorizando o crítico.
    const processedMedicineIds = new Set()

    stockSummary.forEach((item) => {
      const medId = item.medicine.id
      if (processedMedicineIds.has(medId)) return

      // Priorização rígida utilizando flags do stockSummary consolidado
      if (item.isZero || item.isLow) {
        const severity = item.isZero ? 'critical' : 'warning'
        const title = item.isZero ? 'Estoque Zerado' : 'Estoque Baixo'

        let daysLabel = ''
        if (item.isZero || item.daysRemaining === 0) {
          daysLabel = 'hoje'
        } else if (item.daysRemaining === Infinity) {
          daysLabel = 'em breve'
        } else {
          daysLabel = `em ${item.daysRemaining} dias`
        }

        const message = item.isZero
          ? `O estoque total de ${item.medicine.name} acabou.`
          : `${item.medicine.name} acabará ${daysLabel} (Total: ${item.total} restantes).`

        alerts.push({
          id: `stock-${item.medicine.id}`,
          severity,
          title,
          message,
          type: 'stock',
          medicine_id: item.medicine.id,
          scheduled_time: null,
          actions: [
            {
              label: 'COMPRAR',
              type: 'placeholder',
              title: 'Em breve: integração com farmácias para compra direta',
            },
            { label: 'ESTOQUE', type: 'secondary' },
          ],
        })
        processedMedicineIds.add(medId)
      }
    })

    // Alerta de Doses Atrasadas
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    rawProtocols.forEach((p) => {
      p.time_schedule?.forEach((time) => {
        const [h, m] = time.split(':').map(Number)
        const doseMinutes = h * 60 + m
        const delay = currentMinutes - doseMinutes

        // Uma dose é considerada atrasada apenas se passaram mais de 120 minutos (2 horas) do horário previsto
        // E ela deve ser de hoje (delay < 1440)
        const isPastTolerance = delay > 120

        if (delay > 0 && delay < 1440) {
          // Verificar se já foi tomada dentro da janela de tolerância
          const alreadyTaken = logs.some(
            (l) => l.protocol_id === p.id && isDoseInToleranceWindow(time, l.taken_at)
          )

          if (!alreadyTaken && isPastTolerance) {
            alerts.push({
              id: `delay-${p.id}-${time}`,
              severity: delay > 240 ? 'critical' : 'warning', // Mais de 4h de atraso vira crítico
              title: delay > 240 ? 'Atraso Crítico' : 'Dose Atrasada',
              message: `${p.medicine?.name} era às ${time} (${Math.floor(delay / 60)}h ${delay % 60}min atrás)`,
              protocol_id: p.id,
              scheduled_time: time, // CRÍTICO: Necessário para cálculo de expiração do snooze
              delay_minutes: delay,
              actions: [
                { label: 'TOMAR', type: 'primary' },
                { label: 'ADIAR', type: 'secondary' },
              ],
            })
          }
        }
      })
    })

    // Alerta de Prescrições Vencendo ou Vencidas
    const expiringPrescriptions = getExpiringPrescriptions(rawProtocols)

    expiringPrescriptions.forEach(({ protocol, status, daysRemaining }) => {
      const isExpired = status === PRESCRIPTION_STATUS.VENCIDA
      const severity = isExpired ? 'critical' : 'warning'
      const title = isExpired ? 'Prescrição Vencida' : 'Prescrição Vencendo'

      let message
      if (isExpired) {
        const daysAgo = Math.abs(daysRemaining)
        message = `A prescrição de ${protocol.medicine?.name || 'medicamento'} está vencida há ${daysAgo} ${daysAgo === 1 ? 'dia' : 'dias'}.`
      } else {
        message = `A prescrição de ${protocol.medicine?.name || 'medicamento'} vence em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}.`
      }

      alerts.push({
        id: `${protocol.id}_prescription`,
        severity,
        title,
        message,
        type: 'prescription',
        protocol_id: protocol.id,
        scheduled_time: null,
        actions: [
          { label: 'RENOVAR', type: 'primary' },
        ],
      })
    })

    // Filtrar alertas snoozed (que ainda não expiraram)
    return alerts
      .filter((alert) => {
        const snoozed = validSnoozedAlerts.get(alert.id)
        if (!snoozed) return true // Não está snoozed
        return snoozed.expiresAt <= nowTimestamp // Expirou? Mostrar novamente
      })
      .sort((a) => (a.severity === 'critical' ? -1 : 1))
  }, [rawProtocols, logs, stockSummary, isDoseInToleranceWindow, snoozedAlerts])

  const handleRegisterDose = async (medicineId, protocolId, quantityTaken = 1) => {
    try {
      await logService.create({
        medicine_id: medicineId,
        protocol_id: protocolId,
        quantity_taken: quantityTaken,
        taken_at: new Date().toISOString(),
      })
      analyticsService.track('dose_registered', { timestamp: Date.now() })
      refresh() // Atualiza dashboard context
    } catch (err) {
      console.error(err)
      alert('Erro ao registrar dose. Tente novamente.')
    }
  }

  // Adapters Wave 2 (D-01): bridge entre interface DoseZoneList e handlers existentes
  const handleRegisterFromZone = async (protocolId, dosagePerIntake) => {
    const protocol = rawProtocols.find((p) => p.id === protocolId)
    if (!protocol) return
    return handleRegisterDose(protocol.medicine_id, protocolId, dosagePerIntake)
  }

  const handleBatchRegisterDoses = async (doseItems) => {
    try {
      const logsToSave = doseItems.map((item) => ({
        protocol_id: item.protocolId,
        medicine_id: item.medicineId,
        quantity_taken: item.dosagePerIntake,
        taken_at: new Date().toISOString(),
        notes: '[Lote DoseZoneList]',
      }))
      await logService.createBulk(logsToSave)
      refresh()
    } catch (err) {
      console.error('Erro no registro em lote:', err)
      alert('Erro ao registrar lote. Tente novamente.')
    }
  }

  const handleToggleDoseSelection = (protocolId, scheduledTime) => {
    const key = `${protocolId}:${scheduledTime}`
    setSelectedDoseKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (isLoading || contextLoading) return <Loading text="Sincronizando Command Center..." />

  return (
    <div className={styles.container}>
      {/* 1. Header Compact - Greeting + HealthScore Side-by-Side */}
      <header className={styles.header}>
        <div className={styles.welcome}>
          <span className={styles.greeting}>{getGreeting()}</span>
          <div className={styles.userInfo}>
            <button
              className={styles.userName}
              onClick={() => onNavigate?.('settings')}
              title="Configurações"
            >
              {userName}
              <span className={styles.dot}>.</span>
            </button>
            <button
              className={styles.reportButton}
              onClick={() => setIsReportModalOpen(true)}
              title="Gerar Relatório"
              aria-label="Gerar Relatório PDF"
            >
              📊
            </button>
            <ThemeToggle size="sm" position="inline" />
          </div>
        </div>
        <RingGauge
          score={stats.score}
          streak={stats.currentStreak}
          size={ringGaugeSize}
          sparklineData={dailyAdherence}
          onClick={() => setIsHealthDetailsOpen(true)}
        />
      </header>

      {/* Sparkline de Adesão Semanal */}
      {!isAdherenceLoading && dailyAdherence.length > 0 && (
        <div className={styles.sparklineContainer}>
          <SparklineAdesao
            adherenceByDay={dailyAdherence}
            size="medium"
            showAxis={false}
            onDayClick={handleDayClick}
          />
          <button
            className={styles.viewAllLink}
            onClick={() => onNavigate?.('calendar')}
            aria-label="Ver calendário completo"
          >
            Ver calendário →
          </button>
        </div>
      )}

      {/* Insight Card - Dinâmico baseado em dados do usuário */}
      {!insightLoading && insight && (
        <InsightCard
          icon={insight.icon}
          text={insight.text}
          highlight={insight.highlight}
          actionLabel={insight.actionLabel}
          onAction={insight.onAction}
        />
      )}

      <HealthScoreDetails
        isOpen={isHealthDetailsOpen}
        onClose={() => setIsHealthDetailsOpen(false)}
        stats={stats}
        stockSummary={stockSummary}
      />

      {/* 2. Smart Alerts Section */}
      <section aria-live="polite" aria-label="Alertas de tratamento">
        <SmartAlerts
          alerts={smartAlerts}
          onAction={(alert, action) => {
            if (action.label === 'TOMAR') {
              if (alert.protocol_id) {
                setPrefillData({ protocol_id: alert.protocol_id, type: 'protocol' })
              } else if (alert.treatment_plan_id) {
                setPrefillData({ treatment_plan_id: alert.treatment_plan_id, type: 'plan' })
              }
              setIsModalOpen(true)
            } else if (action.label === 'COMPRAR') {
              // Placeholder - tooltip informa integração futura
            } else if (action.label === 'ESTOQUE') {
              onNavigate('stock', { medicineId: alert.medicine_id })
            } else if (action.label === 'RENOVAR') {
              // Navegar para a view de protocolos para renovar a prescrição
              onNavigate('protocols')
            } else if (action.label === 'ADIAR') {
              // Calcular tempo de expiração: horário previsto + 4 horas
              const scheduledTime = alert.scheduled_time

              if (scheduledTime) {
                const [h, m] = scheduledTime.split(':').map(Number)
                const scheduledDate = new Date()
                scheduledDate.setHours(h, m, 0, 0)

                // Se horário já passou hoje, usar amanhã
                const now = new Date()
                if (scheduledDate < now) {
                  scheduledDate.setDate(scheduledDate.getDate() + 1)
                }

                const expiresAt = scheduledDate.getTime() + SNOOZE_DURATION_MS

                setSnoozedAlerts((prev) => {
                  const newMap = new Map(prev)
                  newMap.set(alert.id, {
                    snoozedAt: Date.now(),
                    expiresAt: expiresAt,
                    scheduledTime: scheduledTime,
                  })
                  return newMap
                })
              } else {
                // Para alertas sem scheduled_time (ex: estoque), usar expiração padrão de 4 horas
                const expiresAt = Date.now() + SNOOZE_DURATION_MS
                setSnoozedAlerts((prev) => {
                  const newMap = new Map(prev)
                  newMap.set(alert.id, {
                    snoozedAt: Date.now(),
                    expiresAt: expiresAt,
                    scheduledTime: null,
                  })
                  return newMap
                })
              }
            }
          }}
        />
      </section>

      {/* 3. Tratamento — zonas temporais de doses (Wave 2, W2-10) */}
      {/* Substitui: "TRATAMENTO" (TreatmentAccordion loop) + "PRÓXIMAS DOSES" (SwipeRegisterItem loop) */}
      {/* Modo plan reutiliza TreatmentAccordion internamente (Princípio 2 da visão UX) */}
      <section className={styles.section}>
        <ViewModeToggle
          mode={viewMode}
          onChange={(m) => {
            setViewMode(m)
            localStorage.setItem('mr_view_mode', m)
          }}
          hasTreatmentPlans={treatmentPlans.length > 0 && complexityMode !== 'simple'}
        />
        <AdaptiveLayout mode={complexityMode}>
          <DoseZoneList
            zones={zones}
            totals={totals}
            viewMode={viewMode}
            complexityMode={complexityMode}
            onRegisterDose={handleRegisterFromZone}
            onBatchRegister={handleBatchRegisterDoses}
            onToggleSelection={handleToggleDoseSelection}
            selectedDoses={selectedDoseKeys}
          />
        </AdaptiveLayout>
      </section>

      {/* StockBars — projeção visual de estoque por medicamento (Wave 2, W2-09) */}
      {stockBarsItems.length > 0 && (
        <StockBars
          items={stockBarsItems}
          showOnlyCritical={complexityMode === 'complex'}
          maxItems={complexityMode === 'complex' ? 3 : undefined}
          onItemClick={(medicineId) => onNavigate('stock', { medicineId })}
        />
      )}

      {/* 4. Last Doses Widget */}
      <section className={styles.section} aria-label="Últimas doses tomadas">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>ÚLTIMAS DOSES</h2>
        </div>
        <LastDosesWidget
          onViewHistory={() => onNavigate?.('history')}
          viewAllClassName={styles.viewAllLink}
        />
      </section>

      {/* 5. Floating Action Button */}
      <div className={styles.fab}>
        <button
          className="btn-add-manual"
          onClick={() => {
            setPrefillData(null)
            setIsModalOpen(true)
          }}
        >
          + REGISTRO MANUAL
        </button>
        <button
          className="btn-consultation-mode"
          onClick={() => {
            analyticsService.track('consultation_mode_opened')
            onNavigate?.('consultation')
          }}
          style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'transparent',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}
        >
          <span>👨‍⚕️</span>
          Modo Consulta Médica
        </button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setPrefillData(null)
        }}
      >
        <LogForm
          protocols={rawProtocols}
          treatmentPlans={treatmentPlans}
          initialValues={prefillData}
          onSave={async (data) => {
            if (Array.isArray(data)) {
              await logService.createBulk(data)
            } else {
              await logService.create(data)
            }
            setIsModalOpen(false)
            refresh()
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {showConfetti && (
        <ConfettiAnimation
          trigger={showConfetti}
          type="burst"
          onComplete={() => setShowConfetti(false)}
        />
      )}

      {showMilestoneCelebration && currentMilestone && (
        <MilestoneCelebration
          milestone={currentMilestone}
          visible={showMilestoneCelebration}
          onClose={() => setShowMilestoneCelebration(false)}
        />
      )}

      {/* Modal de Drill-Down do Sparkline */}
      <DailyDoseModal
        date={selectedDate}
        isOpen={isDrillDownModalOpen}
        onClose={handleCloseDrillDown}
        logs={dayLogs}
        protocols={rawProtocols}
        isLoading={isDayLogsLoading}
        error={dayLogsError}
        dailySummary={selectedDaySummary}
        onRetry={handleRetryDayLogs}
      />

      {/* Modal de Geração de Relatórios */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      >
        <ReportGenerator onClose={() => setIsReportModalOpen(false)} />
      </Modal>
    </div>
  )
}
