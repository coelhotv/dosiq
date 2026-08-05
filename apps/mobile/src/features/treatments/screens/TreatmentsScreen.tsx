import { useState, useCallback, useMemo } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet, RefreshControl, LayoutAnimation } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
// TODO(040-strict): named imports de 4 ícones simultâneos do lucide-react-native
// batem em TS2305 sob apps/mobile/tsconfig.json (moduleResolution bundler + expo
// base) mesmo existindo no barrel — resolver isolado confirma export presente.
import * as LucideIcons from 'lucide-react-native'
const { Pill, ChevronRight, Plus, CalendarClock } = LucideIcons as any
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import EmptyState from '@shared/components/states/EmptyState'
import TreatmentCard from '@treatments/components/TreatmentCard'
import TreatmentPlanHeader from '@treatments/components/TreatmentPlanHeader'
import ChatEntryButton from '@features/chatbot/components/ChatEntryButton'
import TreatmentTabBar from '@treatments/components/TreatmentTabBar'
import { useTreatments } from '@treatments/hooks/useTreatments'
import { useProfile } from '@profile/hooks/useProfile'
import { colors, spacing, typography, borderRadius, shadows } from '@shared/styles/tokens'
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '@navigation/routes'
import StaleBanner from '@shared/components/feedback/StaleBanner'


const DEFAULT_COMPLEXITY = { isComplex: false, flatData: [] }

function useTreatmentsScreenState() {
  const navigation = useNavigation<any>()
  const {
    groups,
    loading,
    hasLoaded,
    error,
    stale,
    refresh,
    activeTab,
    setActiveTab,
    counts,
    pausados,
    finalizados,
  } = useTreatments()
  const { profile, refresh: refreshProfile } = useProfile()
  const complexityOverride = profile?.complexity_override
  const [expandedGroups, setExpandedGroups] = useState({})

  const { isComplex, flatData } = useMemo(() => {
    if (!groups) return DEFAULT_COMPLEXITY
    const total = groups.reduce((acc, g) => acc + g.protocols.length, 0)
    const flat = groups.flatMap(g => g.protocols)
    const complex = complexityOverride
      ? complexityOverride === 'complex'
      : total > 3
    return { isComplex: complex, flatData: flat }
  }, [groups, complexityOverride])

  const goToMedicines = useCallback(() => {
    lightTap()
    navigation.navigate(ROUTES.MEDICINES_LIST)
  }, [navigation])

  const goToCreate = useCallback(() => {
    lightTap()
    navigation.navigate(ROUTES.PROTOCOL_FORM)
  }, [navigation])

  const openProtocolDetail = useCallback((id) => {
    lightTap()
    navigation.navigate(ROUTES.PROTOCOL_DETAIL, { id })
  }, [navigation])

  const goToCreateInGroup = useCallback((groupId) => {
    lightTap()
    navigation.navigate(ROUTES.PROTOCOL_FORM, { treatment_plan_id: groupId })
  }, [navigation])

  const totalAcrossTabs = (counts?.ativos ?? 0) + (counts?.pausados ?? 0) + (counts?.finalizados ?? 0)
  const isEmpty = totalAcrossTabs === 0

  useFocusEffect(
    useCallback(() => {
      refresh()
      refreshProfile()
    }, [refresh, refreshProfile])
  )

  const toggleGroup = useCallback((groupId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedGroups(prev => {
      const isCurrentlyExpanded = prev[groupId] !== false
      return {
        ...prev,
        [groupId]: !isCurrentlyExpanded
      }
    })
  }, [])

  return {
    groups,
    loading,
    hasLoaded,
    error,
    stale,
    refresh,
    activeTab,
    setActiveTab,
    counts,
    pausados,
    finalizados,
    expandedGroups,
    isComplex,
    flatData,
    goToMedicines,
    goToCreate,
    openProtocolDetail,
    goToCreateInGroup,
    isEmpty,
    toggleGroup,
  }
}

function SimpleProtocolList({ items, emptyMessage, onOpenDetail }) {
  if (items.length === 0) {
    return <Text style={styles.tabEmpty}>{emptyMessage}</Text>
  }
  return (
    <View style={styles.simpleList}>
      {items.map(protocol => (
        <TreatmentCard
          key={protocol.id}
          treatment={protocol}
          tabStatus={protocol.tabStatus}
          endDate={protocol.endDate}
          onPress={() => onOpenDetail(protocol.id)}
        />
      ))}
    </View>
  )
}

function GroupedProtocolSection({ group, isExpanded, onToggle, onOpenDetail, onCreateInGroup }) {
  return (
    <View style={styles.groupContainer}>
      <TreatmentPlanHeader
        title={group.title}
        emoji={group.emoji}
        color={group.color}
        isExpanded={isExpanded}
        onToggle={onToggle}
        count={group.protocols.length}
      />
      {isExpanded && (
        <View style={styles.protocolsList}>
          {group.protocols.map(protocol => (
            <TreatmentCard
              key={protocol.id}
              treatment={protocol}
              tabStatus={protocol.tabStatus}
              endDate={protocol.endDate}
              onPress={() => onOpenDetail(protocol.id)}
            />
          ))}
          <Pressable
            onPress={onCreateInGroup}
            style={({ pressed }) => [
              styles.addToGroup,
              pressed && styles.addToGroupPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Adicionar novo tratamento ao grupo ${group.title}`}
          >
            <Plus size={16} color={colors.primary[700]} />
            <Text style={styles.addToGroupText}>Adicionar novo tratamento ao grupo</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

export default function TreatmentsScreen() {
  const state = useTreatmentsScreenState()

  if (!state.hasLoaded) {
    return (
      <ScreenContainer>
        <LoadingState message="Carregando tratamentos..." />
      </ScreenContainer>
    )
  }

  if (state.error && !state.groups) {
    return (
      <ScreenContainer>
        <ErrorState message={state.error} onRetry={state.refresh} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {state.stale && <StaleBanner />}
      
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={state.loading && !!state.groups}
            onRefresh={state.refresh}
            tintColor={colors.status.success}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.title}>Tratamentos</Text>
            <Text style={styles.subtitle}>Gerencie medicamentos e seus tratamentos</Text>
          </View>
          <ChatEntryButton />
        </View>

        {/* Link Medicamentos no topo APENAS no estado zero — destaque para onboarding.
            Quando há tratamentos, o link migra para o rodapé (gestão diária = tratamentos). */}
        {state.isEmpty && (
          <Pressable
            onPress={state.goToMedicines}
            style={({ pressed }) => [styles.medicinesLink, pressed && styles.medicinesLinkPressed]}
            accessibilityRole="button"
            accessibilityLabel="Medicamentos"
          >
            <Pill size={18} color={colors.primary[700]} />
            <Text style={styles.medicinesLinkText}>Medicamentos</Text>
            <ChevronRight size={18} color={colors.primary[700]} />
          </Pressable>
        )}

        {state.isEmpty ? (
          <EmptyState
            icon={<CalendarClock size={48} color={colors.primary[500]} strokeWidth={1.5} /> as any}
            title="Nenhum tratamento cadastrado"
            message="Configure doses e horários para receber lembretes e acompanhar a adesão."
            action={{ label: '+ Criar primeiro tratamento', onPress: state.goToCreate }}
          />
        ) : (
          <>
            <TreatmentTabBar
              activeTab={state.activeTab}
              counts={state.counts}
              onChange={state.setActiveTab}
            />

            {state.activeTab === 'ativos' && state.counts.ativos === 0 ? (
              <Text style={styles.tabEmpty}>Nenhum tratamento ativo no momento.</Text>
            ) : null}

            {state.activeTab === 'pausados' && (
              <SimpleProtocolList
                items={state.pausados}
                emptyMessage="Nenhum tratamento pausado."
                onOpenDetail={state.openProtocolDetail}
              />
            )}

            {state.activeTab === 'finalizados' && (
              <SimpleProtocolList
                items={state.finalizados}
                emptyMessage="Nenhum tratamento finalizado ainda."
                onOpenDetail={state.openProtocolDetail}
              />
            )}

            {state.activeTab === 'ativos' && state.counts.ativos > 0 && (
              !state.isComplex ? (
                /* MODO SIMPLE: Dona Maria (Lista direta sem accordions) */
                <SimpleProtocolList
                  items={state.flatData}
                  emptyMessage="Nenhum tratamento ativo no momento."
                  onOpenDetail={state.openProtocolDetail}
                />
              ) : (
                /* MODO COMPLEX: Carlos (Agrupado por planos/classes) */
                state.groups.map(group => (
                  <GroupedProtocolSection
                    key={group.id}
                    group={group}
                    isExpanded={state.expandedGroups[group.id] !== false}
                    onToggle={() => state.toggleGroup(group.id)}
                    onOpenDetail={state.openProtocolDetail}
                    onCreateInGroup={() => state.goToCreateInGroup(group.id)}
                  />
                ))
              )
            )}
          </>
        )}

        {!state.isEmpty && (
          <Pressable
            onPress={state.goToMedicines}
            style={({ pressed }) => [
              styles.medicinesLink,
              styles.medicinesLinkFooter,
              pressed && styles.medicinesLinkPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Medicamentos"
          >
            <Pill size={18} color={colors.primary[700]} />
            <Text style={styles.medicinesLinkText}>Medicamentos</Text>
            <ChevronRight size={18} color={colors.primary[700]} />
          </Pressable>
        )}
      </ScrollView>

      {!state.isEmpty && (
        <Pressable
          onPress={state.goToCreate}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Criar novo tratamento"
        >
          <Plus size={28} color={colors.text.inverse} />
        </Pressable>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing[10],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    marginBottom: spacing[2],
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: spacing[1],
    fontFamily: typography.fontFamily.medium || 'System',
  },
  groupContainer: {
    // marginBottom maior que o gap interno: o link "+ Adicionar ao grupo"
    // pertence ao grupo atual; separa visualmente do próximo header.
    marginBottom: spacing[2],
  },
  protocolsList: {
    marginTop: spacing[1],
  },
  simpleList: {
    paddingTop: spacing[2],
  },
  tabEmpty: {
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
  },
  medicinesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    marginBottom: spacing[3],
  },
  medicinesLinkPressed: {
    opacity: 0.6,
  },
  medicinesLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
  medicinesLinkFooter: {
    marginTop: spacing[6],
    marginBottom: spacing[2],
  },
  addToGroup: {
    // DESIGN-SYSTEM §2 No-Line Rule: sem borda 1px. Boundary via shift
    // de background — chip soft primary[50] com cantos arredondados.
    // RN também não suporta borderStyle dashed/dotted (AP-163).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
    marginHorizontal: spacing[4],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  addToGroupPressed: {
    opacity: 0.6,
  },
  addToGroupText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
  fab: {
    // Paridade Fase 1 (MedicinesListScreen): primary[500] verde + shadows.md.
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
})
