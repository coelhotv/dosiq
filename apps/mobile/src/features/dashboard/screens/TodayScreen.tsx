import { useState, useMemo, useEffect, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  LayoutAnimation,
  TouchableOpacity,
  Pressable,
  InteractionManager
} from 'react-native'
import { ROUTES } from '../../../navigation/routes'
import { navigationRef } from '@navigation/navigationRef'
import { Plus, CalendarClock, Pill, Ruler, ChevronRight } from 'lucide-react-native'
import { measuresRepo } from '@measures/services/measuresRepo'
import MeasureLogSheet from '@measures/components/MeasureLogSheet'
import MeasureCard from '@measures/components/MeasureCard'
import { useTodayData } from '@dashboard/hooks/useTodayData'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import EmptyState from '@shared/components/states/EmptyState'
import ErrorState from '@shared/components/states/ErrorState'
import { getPeriodFromTime, getNow, getUserTime, parseISO } from '@dosiq/core'
import { useTodayMeasures } from '@measures/hooks/useTodayMeasures'
import AdherenceDayCard from '@dashboard/components/AdherenceDayCard'
import TimeBlockSeparator from '@dashboard/components/TimeBlockSeparator'
import DoseTimelineCard from '@dashboard/components/DoseTimelineCard'
import HeroDoseCard from '@dashboard/components/HeroDoseCard'
import StockAlertInline from '@dashboard/components/StockAlertInline'
import DoseRegisterModal from '@dose/components/DoseRegisterModal'
import ChatEntryButton from '@features/chatbot/components/ChatEntryButton'
import { lightTap } from '@shared/utils/haptics'
import BulkDoseRegisterModal from '@dose/components/BulkDoseRegisterModal'
import StaleBanner from '@shared/components/feedback/StaleBanner'
import NudgeBanner from '@shared/components/ui/NudgeBanner'
import { useNudges } from '@profile/hooks/useNudges'
import { colors, spacing, typography, borderRadius, shadows } from '@shared/styles/tokens'


// HH:MM local de uma medida (p/ posicionar no período da agenda).
function _measureTime(iso, tz) {
  const d = getUserTime(parseISO(iso), tz)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Mescla itens-dose com medidas do dia, ordenado por horário (interleave da agenda — FR-011).
function _mergeTimelineWithMeasures(timeline, measures, tz) {
  if (!measures || measures.length === 0) return timeline
  const measureItems = measures.map((m) => ({
    id: `bio:${m.id}`,
    kind: 'measure',
    scheduledTime: _measureTime(m.measured_at, tz),
    measure: m,
  }))
  return [...timeline, ...measureItems].sort((a, b) =>
    (a.scheduledTime || '').localeCompare(b.scheduledTime || '')
  )
}

// Agrupa doses da timeline por turno e computa contadores
function _groupTimeline(timeline, isComplex) {
  const counts = {}
  const grouped = timeline.reduce((acc, item) => {
    const shift = getPeriodFromTime(item.scheduledTime)
    if (!acc[shift]) {
      acc[shift] = []
      counts[shift] = { total: 0, taken: 0 }
    }
    acc[shift].push(item)
    // Medida (biomarcador) entra no grupo p/ interleave, mas NÃO conta na adesão (não é dose).
    if (item.kind === 'measure') return acc
    counts[shift].total += 1
    if (item.isRegistered) counts[shift].taken += 1
    return acc
  }, {})

  const allShifts = ['Madrugada', 'Manhã', 'Tarde', 'Noite']
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

// Renderiza conteúdo de um turno expandido (Complex mode). Itens podem ser dose ou medida.
function _renderShiftDoses(items, handleOpenRegister) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyShiftContainer}>
        <Text style={styles.emptyShiftText}>Nenhum medicamento para este período</Text>
      </View>
    )
  }
  return items.map((item) =>
    item.kind === 'measure'
      ? <MeasureCard key={item.id} item={item.measure} variant="timeline" />
      : <DoseTimelineCard key={item.id} dose={item} onRegister={handleOpenRegister} />
  )
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
// Entry-point IA top-right (spec 015 onda 2; PO-D1). O <DEV> migrou p/ o título do Perfil.
function TodayHeader({ greeting, todayFormatted }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.date}>{todayFormatted}</Text>
      </View>
      <ChatEntryButton />
    </View>
  )
}

/**
 * Seção opcional de doses (carry-over ou look-ahead).
 *
 * 012 Fase B (FR-008b): `isCarryOver` ativa o rótulo relativo ("ontem · 10:00") nos
 * cards — necessário para doses semanais (GLP-1) cujo prazo de tolerância (5040min)
 * excede "ontem" e pode recuar até 3,5 dias.
 */
function OptionalDoseSection({ title, subtitle, doses, onRegister, keyPrefix, isCarryOver = false }) {
  if (doses.length === 0) return null
  return (
    <View style={styles.carryOverSection}>
      <View style={styles.agendaHeader}>
        <Text style={styles.agendaTitle}>{title}</Text>
        {subtitle ? <Text style={styles.agendaSubtitle}>{subtitle}</Text> : null}
      </View>
      {doses.map((dose) => (
        <DoseTimelineCard key={`${keyPrefix}-${dose.id}`} dose={dose} onRegister={onRegister} isCarryOver={isCarryOver} />
      ))}
    </View>
  )
}

function TodayModals({
  modalProtocol,
  modalScheduledTime,
  modalInstanceId,
  medicineName,
  handleCloseRegister,
  handleRegisterSuccess,
  bulkModal,
  bulkMode,
  userId,
  isComplex,
  instancesByKey,
  setBulkModal,
  refresh,
}) {
  return (
    <>
      <DoseRegisterModal
        visible={modalProtocol !== null}
        protocol={modalProtocol}
        scheduledTime={modalScheduledTime}
        instanceId={modalInstanceId}
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
        isComplex={isComplex}
        instancesByKey={instancesByKey}
        instancedItems={bulkModal?.items ?? null}
        onClose={() => setBulkModal(null)}
        onSuccess={() => { setBulkModal(null); refresh() }}
      />
    </>
  )
}

function TodayLastMeasureSection({ lastTodayMeasure, openMeasuresHub, setMeasureLogOpen }) {
  return (
    <View style={styles.lastMeasureSection}>
      <Text style={styles.lastMeasureTitle}>Última medida</Text>
      {lastTodayMeasure ? (
        <MeasureCard
          item={lastTodayMeasure}
          showChevron
          onPress={() => openMeasuresHub(lastTodayMeasure.type)}
        />
      ) : (
        <Pressable
          onPress={() => { lightTap(); setMeasureLogOpen(true) }}
          style={({ pressed }) => [styles.measureNudge, pressed && styles.measureNudgePressed]}
          accessibilityRole="button"
          accessibilityLabel="Nenhuma medida hoje. Registrar a primeira"
        >
          <View style={styles.measureNudgeIcon}>
            <Ruler size={18} color={colors.status.info} strokeWidth={2} />
          </View>
          <Text style={styles.measureNudgeText}>Nenhuma medida hoje. Toque aqui e registre a primeira!</Text>
          <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  )
}

function TodaySpeedDial({ protocols, speedDialOpen, setSpeedDialOpen, setMeasureLogOpen, handleOpenBulkDose }) {
  const handleFabPress = useCallback(() => {
    lightTap()
    setSpeedDialOpen((o) => !o)
  }, [setSpeedDialOpen])

  if (protocols.length === 0) return null

  return (
    <>
      {speedDialOpen && (
        <>
          <Pressable style={styles.speedDialBackdrop} onPress={() => setSpeedDialOpen(false)} accessibilityLabel="Fechar menu" />
          <View style={styles.speedDialActions}>
            <Pressable
              style={({ pressed }) => [styles.speedAction, pressed && styles.fabPressed]}
              onPress={() => { setSpeedDialOpen(false); setMeasureLogOpen(true) }}
              accessibilityRole="button"
              accessibilityLabel="Registrar medida"
            >
              <Text style={styles.speedActionText}>Registrar medida</Text>
              <View style={[styles.speedActionIcon, { backgroundColor: colors.status.info }]}>
                <Ruler size={20} color={colors.text.inverse} strokeWidth={2.5} />
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.speedAction, pressed && styles.fabPressed]}
              onPress={() => { setSpeedDialOpen(false); handleOpenBulkDose() }}
              accessibilityRole="button"
              accessibilityLabel="Registrar dose"
            >
              <Text style={styles.speedActionText}>Registrar dose</Text>
              <View style={styles.speedActionIcon}>
                <Pill size={20} color={colors.text.inverse} strokeWidth={2.5} />
              </View>
            </Pressable>
          </View>
        </>
      )}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handleFabPress}
        accessibilityRole="button"
        accessibilityLabel={speedDialOpen ? 'Fechar menu de registro' : 'Registrar dose ou medida'}
        accessibilityState={{ expanded: speedDialOpen }}
      >
        <Plus size={24} color="#FFF" strokeWidth={3} style={speedDialOpen ? styles.fabIconOpen : null} />
      </Pressable>
    </>
  )
}

function TodayScreenContent({
  data, stale, isDaySegregated, loading, refresh,
  timeline, carryOver, lookAhead, stockAlerts, protocols, stats,
  isComplex, shifts, groupedTimeline, countsByShift,
  expandedShifts, toggleShift,
  modalProtocol, modalScheduledTime, modalInstanceId, medicineName, handleOpenRegister, handleRegisterSuccess, handleCloseRegister,
  bulkModal, setBulkModal,
  handleOpenBulkDose,
  refreshTodayMeasures,
  todayMeasures,
  navigation,
}) {
  const { nudge: dashboardNudge, dismiss: dismissNudge, handleAction: handleNudgeAction, refresh: refreshNudge } = useNudges('dashboard')
  const [speedDialOpen, setSpeedDialOpen] = useState(false)
  const [measureLogOpen, setMeasureLogOpen] = useState(false)

  const priorityDoses = useMemo(() => {
    const todayUrgent = timeline.filter(d => d.timelineStatus === 'PROXIMA' || d.timelineStatus === 'ATRASADA')
    const aheadImminent = lookAhead.filter(d => d.timelineStatus === 'PROXIMA')
    return [...carryOver, ...todayUrgent, ...aheadImminent]
      .sort((a, b) => (a.scheduledFor || '').localeCompare(b.scheduledFor || ''))
  }, [carryOver, timeline, lookAhead])

  const instancesByKey = useMemo(() => timeline.reduce((map, d) => {
    if (d.instanceId && d.protocol?.id && d.scheduledTime) {
      map[`${d.protocol.id}|${d.scheduledTime}`] = d.instanceId
    }
    return map
  }, {}), [timeline])

  const heroItems = useMemo(() => priorityDoses.map(d => ({
    id: d.instanceId,
    protocol: d.protocol,
    scheduledTime: d.scheduledTime,
    plan: d.protocol?.treatment_plan,
    instanceId: d.instanceId,
  })), [priorityDoses])

  const { greeting, todayFormatted } = _buildHeaderData(data?.user)
  const adherenceTrend = stats.hasPreviousData
    ? `${stats.trend >= 0 ? '+' : ''}${stats.trend}% vs semana anterior`
    : ''
  const bulkMode = bulkModal?.mode ?? 'plan'
  const userId = data?.user?.id ?? ''
  const lastTodayMeasure = todayMeasures?.[0] ?? null

  const handleSaveMeasure = useCallback(async (payload) => {
    const created = await measuresRepo.create(payload)
    refreshTodayMeasures?.()
    return created
  }, [refreshTodayMeasures])

  const openMeasuresHub = useCallback((measureType) => {
    navigationRef.navigate(ROUTES.PROFILE)
    InteractionManager.runAfterInteractions(() => {
      navigationRef.navigate(ROUTES.MEASURES, { type: measureType })
    })
  }, [])

  return (
    <ScreenContainer>
      {stale && <StaleBanner isDaySegregated={isDaySegregated} />}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={() => { refresh(); refreshNudge() }} tintColor={colors.status.success} />}
      >
        <TodayHeader greeting={greeting} todayFormatted={todayFormatted} />
        <AdherenceDayCard score={stats.score} trend={adherenceTrend} />
        <StockAlertInline alerts={stockAlerts} />
        {priorityDoses.length > 0 ? (
          <HeroDoseCard doses={priorityDoses} onPress={() => setBulkModal({ mode: 'hero', items: heroItems })} />
        ) : (
          <NudgeBanner nudge={dashboardNudge} onAction={handleNudgeAction} onDismiss={dismissNudge} />
        )}
        <OptionalDoseSection
          title="Doses pendentes"
          subtitle="Doses anteriores ainda no prazo de registro"
          doses={carryOver}
          onRegister={handleOpenRegister}
          keyPrefix="carry"
          isCarryOver
        />
        <View style={styles.agendaHeader}>
          <Text style={styles.agendaTitle}>Agenda de Hoje</Text>
        </View>
        <TodayAgendaContent
          protocols={protocols} isComplex={isComplex} timeline={timeline}
          shifts={shifts} groupedTimeline={groupedTimeline} countsByShift={countsByShift}
          expandedShifts={expandedShifts} toggleShift={toggleShift} handleOpenRegister={handleOpenRegister}
          navigation={navigation}
        />
        <OptionalDoseSection title="Em breve" doses={lookAhead} onRegister={handleOpenRegister} keyPrefix="ahead" />

        <TodayLastMeasureSection
          lastTodayMeasure={lastTodayMeasure}
          openMeasuresHub={openMeasuresHub}
          setMeasureLogOpen={setMeasureLogOpen}
        />
      </ScrollView>

      <TodaySpeedDial
        protocols={protocols}
        speedDialOpen={speedDialOpen}
        setSpeedDialOpen={setSpeedDialOpen}
        setMeasureLogOpen={setMeasureLogOpen}
        handleOpenBulkDose={handleOpenBulkDose}
      />

      <MeasureLogSheet
        open={measureLogOpen}
        onClose={() => setMeasureLogOpen(false)}
        onSaved={handleSaveMeasure}
      />
      <TodayModals
        modalProtocol={modalProtocol}
        modalScheduledTime={modalScheduledTime}
        modalInstanceId={modalInstanceId}
        medicineName={medicineName}
        handleCloseRegister={handleCloseRegister}
        handleRegisterSuccess={handleRegisterSuccess}
        bulkModal={bulkModal}
        bulkMode={bulkMode}
        userId={userId}
        isComplex={isComplex}
        instancesByKey={instancesByKey}
        setBulkModal={setBulkModal}
        refresh={refresh}
      />
    </ScreenContainer>
  )
}

// Renderiza a agenda de doses (Simple ou Complex mode)
function TodayAgendaContent({ protocols, isComplex, timeline, shifts, groupedTimeline, countsByShift, expandedShifts, toggleShift, handleOpenRegister, navigation }) {
  if (protocols.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock size={48} color={colors.primary[500]} strokeWidth={1.5} />}
        title="Comece seu primeiro tratamento"
        message="Configure doses e horários para receber lembretes e acompanhar a adesão."
        action={{
          label: '+ Criar primeiro tratamento',
          onPress: () => navigation?.navigate(ROUTES.TREATMENTS, { screen: ROUTES.PROTOCOL_FORM }),
        }}
      />
    )
  }
  if (!isComplex) {
    return (
      <View style={styles.simpleList}>
        {timeline.map((item) =>
          item.kind === 'measure'
            ? <MeasureCard key={item.id} item={item.measure} variant="timeline" />
            : <DoseTimelineCard key={item.id} dose={item} onRegister={handleOpenRegister} />
        )}
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

function _extractTodayScreenData(data) {
  const {
    timeline = [],
    carryOver = [],
    lookAhead = [],
    stockAlerts = [],
    protocols = [],
    medicines = {},
    stats = { expected: 0, taken: 0, score: 0 },
    user = null,
    localDay = null,
    timezone = 'America/Sao_Paulo',
  } = data || {}

  return {
    timeline,
    carryOver,
    lookAhead,
    stockAlerts,
    protocols,
    medicines,
    stats,
    user,
    currentDay: localDay,
    timezone,
  }
}

export default function TodayScreen({ route, navigation }) {
  // States
  const [modalProtocol, setModalProtocol] = useState(null)
  const [modalScheduledTime, setModalScheduledTime] = useState(null)
  const [modalInstanceId, setModalInstanceId] = useState(null)
  // null | { mode, planId?, protocolIds?, scheduledTime, treatmentPlanName? }
  const [bulkModal, setBulkModal] = useState(null)
  const [expandedShifts, setExpandedShifts] = useState({})
  const [lastHeuristicDay, setLastHeuristicDay] = useState(null)

  const { data, loading, error, stale, isDaySegregated, refresh } = useTodayData()

  // Pre-resolve optional chains do data para reduzir complexidade ciclomática
  const {
    timeline,
    carryOver,
    lookAhead,
    stockAlerts,
    protocols,
    medicines,
    stats,
    user,
    currentDay,
    timezone,
  } = useMemo(() => _extractTodayScreenData(data), [data])

  // 1. Lógica de Persona: Threshold de complexidade adaptativa (Wave 10A)
  const complexityOverride = user?.complexity_override
  const isComplex = useMemo(() => {
    if (complexityOverride) return complexityOverride === 'complex'
    return Object.keys(medicines).length > 3
  }, [medicines, complexityOverride])

  // 012 Fase C — medidas do dia mescladas na agenda (interleave, FR-011).
  const { items: todayMeasures, refresh: refreshTodayMeasures } = useTodayMeasures(timezone)
  const timelineWithMeasures = useMemo(
    () => _mergeTimelineWithMeasures(timeline, todayMeasures, timezone),
    [timeline, todayMeasures, timezone]
  )

  // Carlos (isComplex) vê todos os turnos. Dona Maria vê apenas onde há doses.
  const { groupedTimeline, shifts, countsByShift } = useMemo(
    () => _groupTimeline(timelineWithMeasures, isComplex),
    [timelineWithMeasures, isComplex]
  )

  // Heurística de Expansão Inicial - Ajuste de Estado no Render (React 19 Pattern)
  if (currentDay && currentDay !== lastHeuristicDay) {
    setExpandedShifts(_computeInitialExpanded(shifts, groupedTimeline))
    setLastHeuristicDay(currentDay)
  }

  // Effects
  // Refresh ao focar: re-lê complexity_override alterado em Configurações
  // (e captura doses/tratamentos novos). Paridade com TreatmentsScreen.
  useFocusEffect(
    useCallback(() => {
      refresh()
      refreshTodayMeasures()
    }, [refresh, refreshTodayMeasures])
  )

  // 2. Deeplink params de push notification (N1.4 → N1.5)
  const routeParams = route?.params
  useEffect(() => {
    if (!routeParams?.screen) return
    setTimeout(() => {
      _resolveDeeplinkModal(routeParams, protocols, setBulkModal, setModalProtocol, setModalScheduledTime)
      navigation?.setParams({ screen: undefined, planId: undefined, protocolIds: undefined })
    }, 0)
  }, [routeParams, navigation, protocols])

  // Handlers
  const toggleShift = useCallback((shift) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedShifts(prev => ({
      ...prev,
      [shift]: !prev[shift]
    }))
  }, [])

  const handleOpenBulkDose = useCallback(() => {
    lightTap()
    setBulkModal({
      mode: 'active',
      scheduledTime: '',
    })
  }, [])

  const medicineName = _resolveMedicineName(modalProtocol, medicines)

  const handleOpenRegister = useCallback((protocol, scheduledTime, instanceId = null) => {
    setModalProtocol(protocol)
    setModalScheduledTime(scheduledTime)
    setModalInstanceId(instanceId)
  }, [])

  const handleCloseRegister = useCallback(() => {
    setModalProtocol(null)
    setModalScheduledTime(null)
    setModalInstanceId(null)
  }, [])

  const handleRegisterSuccess = useCallback(() => {
    setModalProtocol(null)
    setModalScheduledTime(null)
    setModalInstanceId(null)
    refresh()
  }, [refresh])

  if (loading && !data) return <LoadingState message="Carregando o seu dia..." />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />

  return (
    <TodayScreenContent
      data={data} stale={stale} isDaySegregated={isDaySegregated} loading={loading} refresh={refresh}
      timeline={timelineWithMeasures} carryOver={carryOver} lookAhead={lookAhead} stockAlerts={stockAlerts} protocols={protocols} stats={stats} medicines={medicines}
      refreshTodayMeasures={refreshTodayMeasures} todayMeasures={todayMeasures}
      isComplex={isComplex} shifts={shifts} groupedTimeline={groupedTimeline}
      countsByShift={countsByShift} expandedShifts={expandedShifts} toggleShift={toggleShift}
      modalProtocol={modalProtocol} modalScheduledTime={modalScheduledTime} modalInstanceId={modalInstanceId}
      medicineName={medicineName} handleOpenRegister={handleOpenRegister}
      handleRegisterSuccess={handleRegisterSuccess} handleCloseRegister={handleCloseRegister}
      bulkModal={bulkModal} setBulkModal={setBulkModal}
      handleOpenBulkDose={handleOpenBulkDose}
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
  carryOverSection: {
    marginBottom: spacing[2],
  },
  agendaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  // 012 Fase B (FR-008b): subtítulo descritivo abaixo do título da seção carry-over
  agendaSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular || 'System',
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
  },
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[5],
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  fabPressed: {
    opacity: 0.9,
  },
  fabIconOpen: {
    transform: [{ rotate: '45deg' }],
  },
  lastMeasureSection: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  lastMeasureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // Nudge "Nenhuma medida hoje" — tracejado p/ diferenciar de registro real (não é dado).
  measureNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'solid', // AP-163: RN só suporta 'solid'; 'dashed' dispara WARN (multiplica por frame)
    borderColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  measureNudgePressed: { opacity: 0.7 },
  measureNudgeIcon: {
    width: 36, height: 36, borderRadius: borderRadius.full,
    backgroundColor: colors.status.infoLight, alignItems: 'center', justifyContent: 'center',
  },
  measureNudgeText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
  },
  speedDialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  speedDialActions: {
    position: 'absolute',
    right: spacing[5],
    bottom: spacing[6] + 56 + spacing[3],
    gap: spacing[3],
    alignItems: 'flex-end',
  },
  speedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  speedActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    backgroundColor: colors.bg.card,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  speedActionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
})
