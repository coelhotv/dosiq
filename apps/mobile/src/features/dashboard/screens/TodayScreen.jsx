import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  TouchableOpacity
} from 'react-native'
import { ROUTES } from '../../../navigation/routes'
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

// Agrupa doses da timeline por turno e computa contadores
function _groupTimeline(timeline, isComplex) {
  const counts = {}
  const grouped = timeline.reduce((acc, dose) => {
    const shift = getPeriodFromTime(dose.scheduledTime)
    if (!acc[shift]) {
      acc[shift] = []
      counts[shift] = { total: 0, taken: 0 }
    }
    acc[shift].push(dose)
    counts[shift].total += 1
    if (dose.isRegistered) counts[shift].taken += 1
    return acc
  }, {})

  const allShifts = ['Manhã', 'Tarde', 'Noite', 'Madrugada']
  const shifts = isComplex
    ? allShifts
    : allShifts.filter(s => grouped[s] && grouped[s].length > 0)

  return { groupedTimeline: grouped, shifts, countsByShift: counts }
}

// Calcula estado inicial de expansão dos turnos
function _computeInitialExpanded(shifts, groupedTimeline) {
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
  return initial
}

// Renderiza conteúdo de um turno expandido (Complex mode)
function _renderShiftDoses(doses, handleOpenRegister) {
  if (doses.length === 0) {
    return (
      <View style={styles.emptyShiftContainer}>
        <Text style={styles.emptyShiftText}>Nenhum medicamento para este turno</Text>
      </View>
    )
  }
  return doses.map((dose) => (
    <DoseTimelineCard key={dose.id} dose={dose} onRegister={handleOpenRegister} />
  ))
}

// Resolve o modal a abrir a partir dos params de deeplink
function _resolveDeeplinkModal(params, protocols, setBulkModal, setModalProtocol, setModalScheduledTime) {
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
}

// Resolve o nome do medicamento do protocolo selecionado
function _resolveMedicineName(modalProtocol, medicines) {
  if (!modalProtocol) return ''
  return medicines[modalProtocol.medicine_id]?.name ?? 'Medicamento'
}

// Extrai dados do header a partir dos dados do usuário
function _buildHeaderData(user) {
  const fullUserName = user?.name || user?.email?.split('@')[0] || 'Usuário'
  const firstName = fullUserName.trim().split(' ')[0]
  const todayFormatted = getNow().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return { greeting: `Olá, ${firstName}`, todayFormatted }
}

// Conteúdo principal da tela (pós-carregamento) — extrai render para reduzir complexidade
function TodayScreenContent({
  data, stale, isDaySegregated, loading, refresh,
  timeline, stockAlerts, protocols, stats,
  isComplex, shifts, groupedTimeline, countsByShift,
  expandedShifts, toggleShift,
  modalProtocol, modalScheduledTime, medicineName, handleOpenRegister, handleRegisterSuccess, handleCloseRegister,
  bulkModal, setBulkModal,
  navigation,
}) {
  const priorityDoses = timeline
    .filter(d => d.timelineStatus === 'PROXIMA' || d.timelineStatus === 'ATRASADA')
    .slice(0, 3)
  const { greeting, todayFormatted } = _buildHeaderData(data?.user)
  const adherenceTrend = stats.hasPreviousData
    ? `${stats.trend >= 0 ? '+' : ''}${stats.trend}% vs semana anterior`
    : 'Mantendo a média'
  const bulkMode = bulkModal?.mode ?? 'plan'
  const userId = data?.user?.id ?? ''

  return (
    <ScreenContainer>
      {stale && <StaleBanner isDaySegregated={isDaySegregated} />}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.status.success} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.date}>{todayFormatted}</Text>
          </View>
          {__DEV__ && (
            <TouchableOpacity
              style={styles.devBtn}
              onPress={() => navigation?.navigate(ROUTES.FORM_KIT_DEMO)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Abrir Form Kit Demo"
            >
              <Text style={styles.devBtnText}>DEV</Text>
            </TouchableOpacity>
          )}
        </View>
        <AdherenceDayCard score={stats.score} trend={adherenceTrend} />
        <StockAlertInline alerts={stockAlerts} />
        {priorityDoses.length > 0 && (
          <HeroDoseCard doses={priorityDoses} onPress={(d) => handleOpenRegister(d.protocol, d.scheduledTime)} />
        )}
        <View style={styles.agendaHeader}>
          <Text style={styles.agendaTitle}>Agenda de Hoje</Text>
        </View>
        <TodayAgendaContent
          protocols={protocols} isComplex={isComplex} timeline={timeline}
          shifts={shifts} groupedTimeline={groupedTimeline} countsByShift={countsByShift}
          expandedShifts={expandedShifts} toggleShift={toggleShift} handleOpenRegister={handleOpenRegister}
        />
      </ScrollView>
      <DoseRegisterModal
        visible={modalProtocol !== null}
        protocol={modalProtocol}
        scheduledTime={modalScheduledTime}
        medicineName={medicineName}
        onClose={handleCloseRegister}
        onSuccess={handleRegisterSuccess}
      />
      <BulkDoseRegisterModal
        visible={bulkModal !== null}
        mode={bulkMode}
        planId={bulkModal?.planId}
        protocolIds={bulkModal?.protocolIds}
        scheduledTime={bulkModal?.scheduledTime ?? ''}
        treatmentPlanName={bulkModal?.treatmentPlanName}
        userId={userId}
        onClose={() => setBulkModal(null)}
        onSuccess={() => { setBulkModal(null); refresh() }}
      />
    </ScreenContainer>
  )
}

// Renderiza a agenda de doses (Simple ou Complex mode)
function TodayAgendaContent({ protocols, isComplex, timeline, shifts, groupedTimeline, countsByShift, expandedShifts, toggleShift, handleOpenRegister }) {
  if (protocols.length === 0) {
    return (
      <EmptyState
        icon={<Pill size={48} color={colors.status.success} />}
        message={'Sem tratamentos ativos.\nAdicione tratamentos na versão web.'}
      />
    )
  }
  if (!isComplex) {
    return (
      <View style={styles.simpleList}>
        {timeline.map((dose) => (
          <DoseTimelineCard key={dose.id} dose={dose} onRegister={handleOpenRegister} />
        ))}
      </View>
    )
  }
  return shifts.map(shift => {
    const doses = groupedTimeline[shift] || []
    const isExpanded = expandedShifts[shift]
    const shiftCounts = countsByShift[shift] || { total: 0, taken: 0 }
    return (
      <View key={shift} style={styles.shiftContainer}>
        <TimeBlockSeparator
          type={shift}
          isExpanded={isExpanded}
          onToggle={() => toggleShift(shift)}
          isDisabled={doses.length === 0}
          counts={shiftCounts.total > 0 ? shiftCounts : null}
        />
        {isExpanded && (
          <View style={styles.dosesList}>
            {_renderShiftDoses(doses, handleOpenRegister)}
          </View>
        )}
      </View>
    )
  })
}

export default function TodayScreen({ route, navigation }) {
  const [modalProtocol, setModalProtocol] = useState(null)
  const [modalScheduledTime, setModalScheduledTime] = useState(null)
  // null | { mode, planId?, protocolIds?, scheduledTime, treatmentPlanName? }
  const [bulkModal, setBulkModal] = useState(null)
  const [expandedShifts, setExpandedShifts] = useState({})
  const [lastHeuristicDay, setLastHeuristicDay] = useState(null)

  const { data, loading, error, stale, isDaySegregated, refresh } = useTodayData()

  // Pre-resolve optional chains do data para reduzir complexidade ciclomática
  const rawTimeline = data?.timeline
  const rawProtocols = data?.protocols
  const rawMedicines = data?.medicines
  const rawStats = data?.stats
  const rawUser = data?.user
  const currentDay = data?.localDay

  const timeline = useMemo(() => rawTimeline ?? [], [rawTimeline])
  const stockAlerts = data?.stockAlerts ?? []
  const protocols = useMemo(() => rawProtocols ?? [], [rawProtocols])
  const medicines = useMemo(() => rawMedicines ?? {}, [rawMedicines])
  const stats = rawStats ?? { expected: 0, taken: 0, score: 0 }

  // 1. Lógica de Persona: Threshold de complexidade adaptativa (Wave 10A)
  const complexityOverride = rawUser?.complexity_override
  const isComplex = useMemo(() => {
    if (complexityOverride) return complexityOverride === 'complex'
    return Object.keys(medicines).length > 3
  }, [medicines, complexityOverride])

  // Carlos (isComplex) vê todos os turnos. Dona Maria vê apenas onde há doses.
  const { groupedTimeline, shifts, countsByShift } = useMemo(
    () => _groupTimeline(timeline, isComplex),
    [timeline, isComplex]
  )

  // Heurística de Expansão Inicial - Ajuste de Estado no Render (React 19 Pattern)
  if (currentDay && currentDay !== lastHeuristicDay) {
    setExpandedShifts(_computeInitialExpanded(shifts, groupedTimeline))
    setLastHeuristicDay(currentDay)
  }

  // 2. Deeplink params de push notification (N1.4 → N1.5)
  const routeParams = route?.params
  useEffect(() => {
    if (!routeParams?.screen) return
    setTimeout(() => {
      _resolveDeeplinkModal(routeParams, protocols, setBulkModal, setModalProtocol, setModalScheduledTime)
      navigation?.setParams({ screen: undefined, planId: undefined, protocolIds: undefined })
    }, 0)
  }, [routeParams, navigation, protocols])


  const toggleShift = useCallback((shift) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedShifts(prev => ({
      ...prev,
      [shift]: !prev[shift]
    }))
  }, [])

  if (loading && !data) return <LoadingState message="Carregando o seu dia..." />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />

  const medicineName = _resolveMedicineName(modalProtocol, medicines)

  function handleOpenRegister(protocol, scheduledTime) {
    setModalProtocol(protocol)
    setModalScheduledTime(scheduledTime)
  }

  function handleCloseRegister() {
    setModalProtocol(null)
    setModalScheduledTime(null)
  }

  function handleRegisterSuccess() {
    setModalProtocol(null)
    setModalScheduledTime(null)
    refresh()
  }

  return (
    <TodayScreenContent
      data={data} stale={stale} isDaySegregated={isDaySegregated} loading={loading} refresh={refresh}
      timeline={timeline} stockAlerts={stockAlerts} protocols={protocols} stats={stats} medicines={medicines}
      isComplex={isComplex} shifts={shifts} groupedTimeline={groupedTimeline}
      countsByShift={countsByShift} expandedShifts={expandedShifts} toggleShift={toggleShift}
      modalProtocol={modalProtocol} modalScheduledTime={modalScheduledTime}
      medicineName={medicineName} handleOpenRegister={handleOpenRegister}
      handleRegisterSuccess={handleRegisterSuccess} handleCloseRegister={handleCloseRegister}
      bulkModal={bulkModal} setBulkModal={setBulkModal}
      navigation={navigation}
    />
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  devBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.status.warning,
    marginLeft: 8,
  },
  devBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text.inverse,
    letterSpacing: 1,
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
