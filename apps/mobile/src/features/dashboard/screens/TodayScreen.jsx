import { useState, useMemo, useEffect, useCallback } from 'react'
import { 
  ScrollView, 
  View, 
  Text, 
  RefreshControl, 
  StyleSheet, 
  LayoutAnimation, 
  Platform, 
  UIManager 
} from 'react-native'
import { Pill } from 'lucide-react-native'
import { useTodayData } from '@dashboard/hooks/useTodayData'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import EmptyState from '@shared/components/states/EmptyState'
import ErrorState from '@shared/components/states/ErrorState'
import { getPeriodFromTime, getNow } from '@dosiq/core'
import AdherenceDayCard from '@dashboard/components/AdherenceDayCard'
import TimeBlockSeparator from '@dashboard/components/TimeBlockSeparator'
import DoseTimelineCard from '@dashboard/components/DoseTimelineCard'
import HeroDoseCard from '@dashboard/components/HeroDoseCard'
import StockAlertInline from '@dashboard/components/StockAlertInline'
import DoseRegisterModal from '@dose/components/DoseRegisterModal'
import BulkDoseRegisterModal from '@dose/components/BulkDoseRegisterModal'
import StaleBanner from '@shared/components/feedback/StaleBanner'
import { colors, spacing, typography } from '@shared/styles/tokens'

// Habilitar animações no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function TodayScreen({ route, navigation }) {
  const [modalProtocol, setModalProtocol] = useState(null)
  const [modalScheduledTime, setModalScheduledTime] = useState(null)
  // null | { mode, planId?, protocolIds?, scheduledTime, treatmentPlanName? }
  const [bulkModal, setBulkModal] = useState(null)
  const [expandedShifts, setExpandedShifts] = useState({})
  const [lastHeuristicDay, setLastHeuristicDay] = useState(null)

  const { data, loading, error, stale, isDaySegregated, refresh } = useTodayData()

  const timeline = data?.timeline ?? []
  const stockAlerts = data?.stockAlerts ?? []
  const protocols = data?.protocols ?? []
  const medicines = data?.medicines ?? {}
  const stats = data?.stats ?? { expected: 0, taken: 0, score: 0 }

  // 1. Lógica de Persona: Threshold de complexidade adaptativa (Wave 10A)
  const isComplex = useMemo(() => {
    if (data?.user?.complexity_override) {
      return data.user.complexity_override === 'complex'
    }
    return Object.keys(medicines).length > 3
  }, [medicines, data?.user?.complexity_override])

  const { groupedTimeline, shifts, countsByShift } = useMemo(() => {
    const counts = {}
    const grouped = timeline.reduce((acc, dose) => {
      const shift = getPeriodFromTime(dose.scheduledTime)
      if (!acc[shift]) {
        acc[shift] = []
        counts[shift] = { total: 0, taken: 0 }
      }
      acc[shift].push(dose)
      
      // Acumular contadores (Wave v0.1.5 Otimizada)
      counts[shift].total += 1
      if (dose.isRegistered) counts[shift].taken += 1
      
      return acc
    }, {})
    
    // Carlos (isComplex) vê todos os turnos principais. Dona Maria vê apenas onde há doses.
    const allShifts = ['Manhã', 'Tarde', 'Noite', 'Madrugada']
    const activeShifts = isComplex 
      ? allShifts 
      : allShifts.filter(s => grouped[s] && grouped[s].length > 0)
    
    return { groupedTimeline: grouped, shifts: activeShifts, countsByShift: counts }
  }, [timeline, isComplex])

  // Heurística de Expansão Inicial - Ajuste de Estado no Render (React 19 Pattern)
  const currentDay = data?.localDay
  if (currentDay && currentDay !== lastHeuristicDay) {
    const now = getNow()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const currentShift = getPeriodFromTime(timeStr)

    const initial = {}
    shifts.forEach(shift => {
      const doses = groupedTimeline[shift] || []
      const isCurrent = shift === currentShift
      const hasUrgent = doses.some(d => d.timelineStatus === 'ATRASADA' || d.timelineStatus === 'PROXIMA')
      initial[shift] = isCurrent || hasUrgent
    })
    
    setExpandedShifts(initial)
    setLastHeuristicDay(currentDay)
  }

  // 2. Deeplink params de push notification (N1.4 → N1.5)
  // Abre BulkDoseRegisterModal automaticamente quando a tela é navegada via push tap
  useEffect(() => {
    const params = route?.params
    if (!params?.screen) return
    setTimeout(() => {
      if (params.screen === 'bulk-plan' && params.planId) {
        setBulkModal({
          mode: 'plan',
          planId: params.planId,
          scheduledTime: params.at ?? '',
          treatmentPlanName: params.treatmentPlanName,
        })
      } else if (params.screen === 'bulk-misc') {
        setBulkModal({
          mode: 'misc',
          protocolIds: params.protocolIds ?? [],
          scheduledTime: params.at ?? '',
        })
      } else if (params.screen === 'dose-individual' && params.protocolId) {
        const protocol = protocols.find(p => p.id === params.protocolId)
        if (protocol) {
          setModalProtocol(protocol)
          setModalScheduledTime(params.at ?? null)
        }
      }
      // Limpar params após consumo para evitar re-abertura em back-navigate
      navigation?.setParams({ screen: undefined, planId: undefined, protocolIds: undefined })
    }, 0)
  }, [route?.params, navigation, protocols])


  const toggleShift = useCallback((shift) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedShifts(prev => ({
      ...prev,
      [shift]: !prev[shift]
    }))
  }, [])

  if (loading && !data) return <LoadingState message="Carregando o seu dia..." />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />

  // Doses prioritárias (Hero)
  const priorityDoses = timeline
    .filter(d => d.timelineStatus === 'PROXIMA' || d.timelineStatus === 'ATRASADA')
    .slice(0, 3)

  // Dados do Cabeçalho (Personalização H8.7)
  const fullUserName = data?.user?.name || data?.user?.email?.split('@')[0] || 'Usuário'
  const firstName = fullUserName.trim().split(' ')[0]
  const todayFormatted = getNow().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const greeting = `Olá, ${firstName}`

  function handleOpenRegister(protocol, scheduledTime) {
    setModalProtocol(protocol)
    setModalScheduledTime(scheduledTime)
  }

  function handleRegisterSuccess() {
    setModalProtocol(null)
    setModalScheduledTime(null)
    refresh()
  }

  return (
    <ScreenContainer>
      {stale && <StaleBanner isDaySegregated={isDaySegregated} />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!data}
            onRefresh={refresh}
            tintColor={colors.status.success}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{todayFormatted}</Text>
        </View>

        <AdherenceDayCard 
          score={stats.score} 
          trend={
            stats.hasPreviousData 
              ? `${stats.trend >= 0 ? '+' : ''}${stats.trend}% vs semana anterior`
              : "Mantendo a média"
          }
        />

        <StockAlertInline alerts={stockAlerts} />

        {priorityDoses.length > 0 && (
          <HeroDoseCard 
            doses={priorityDoses} 
            onPress={(d) => handleOpenRegister(d.protocol, d.scheduledTime)} 
          />
        )}

        <View style={styles.agendaHeader}>
          <Text style={styles.agendaTitle}>Agenda de Hoje</Text>
        </View>

        {protocols.length === 0 ? (
          <EmptyState
            icon={<Pill size={48} color={colors.status.success} />}
            message={'Sem tratamentos ativos.\nAdicione tratamentos na versão web.'}
          />
        ) : !isComplex ? (
          /* MODO SIMPLE: Dona Maria (Lista direta cronológica) */
          <View style={styles.simpleList}>
            {timeline.map((dose) => (
              <DoseTimelineCard 
                key={dose.id} 
                dose={dose} 
                onRegister={handleOpenRegister}
              />
            ))}
          </View>
        ) : (
          /* MODO COMPLEX: Carlos (Agrupado por turnos com Accordion) */
          shifts.map(shift => {
            const doses = groupedTimeline[shift] || []
            const isExpanded = expandedShifts[shift]
            const isEmpty = doses.length === 0
            const shiftCounts = countsByShift[shift] || { total: 0, taken: 0 }

            return (
              <View key={shift} style={styles.shiftContainer}>
                <TimeBlockSeparator 
                  type={shift} 
                  isExpanded={isExpanded}
                  onToggle={() => toggleShift(shift)}
                  isDisabled={isEmpty}
                  counts={shiftCounts.total > 0 ? shiftCounts : null}
                />
                
                {isExpanded && (
                  <View style={styles.dosesList}>
                    {isEmpty ? (
                      <View style={styles.emptyShiftContainer}>
                        <Text style={styles.emptyShiftText}>Nenhum medicamento para este turno</Text>
                      </View>
                    ) : (
                      doses.map((dose) => (
                        <DoseTimelineCard 
                          key={dose.id} 
                          dose={dose} 
                          onRegister={handleOpenRegister}
                        />
                      ))
                    )}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      <DoseRegisterModal
        visible={modalProtocol !== null}
        protocol={modalProtocol}
        scheduledTime={modalScheduledTime}
        medicineName={modalProtocol ? (medicines[modalProtocol.medicine_id]?.name ?? 'Medicamento') : ''}
        onClose={() => {
          setModalProtocol(null)
          setModalScheduledTime(null)
        }}
        onSuccess={handleRegisterSuccess}
      />

      <BulkDoseRegisterModal
        visible={bulkModal !== null}
        mode={bulkModal?.mode ?? 'plan'}
        planId={bulkModal?.planId}
        protocolIds={bulkModal?.protocolIds}
        scheduledTime={bulkModal?.scheduledTime ?? ''}
        treatmentPlanName={bulkModal?.treatmentPlanName}
        userId={data?.user?.id ?? ''}
        onClose={() => setBulkModal(null)}
        onSuccess={() => {
          setBulkModal(null)
          refresh()
        }}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  date: {
    fontSize: 16,
    color: colors.text.secondary,
    textTransform: 'capitalize',
    marginTop: 4,
    fontFamily: typography.fontFamily.medium || 'System',
  },
  agendaHeader: {
    paddingHorizontal: 20,
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  agendaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  shiftContainer: {
    marginBottom: spacing[4],
  },
  dosesList: {
    marginTop: 4,
  },
  emptyShiftContainer: {
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyShiftText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.7,
  }
})
