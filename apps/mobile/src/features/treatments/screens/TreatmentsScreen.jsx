import { useState, useCallback, useMemo } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet, RefreshControl, LayoutAnimation, Platform, UIManager } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Pill, ChevronRight, Plus } from 'lucide-react-native'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import LoadingState from '@shared/components/states/LoadingState'
import ErrorState from '@shared/components/states/ErrorState'
import TreatmentCard from '@treatments/components/TreatmentCard'
import TreatmentEmptyState from '@treatments/components/TreatmentEmptyState'
import TreatmentPlanHeader from '@treatments/components/TreatmentPlanHeader'
import TreatmentTabBar from '@treatments/components/TreatmentTabBar'
import { useTreatments } from '@treatments/hooks/useTreatments'
import { colors, spacing, typography, borderRadius, shadows } from '@shared/styles/tokens'
import { lightTap } from '@shared/utils/haptics'
import { ROUTES } from '@navigation/routes'
import StaleBanner from '@shared/components/feedback/StaleBanner'

// Habilitar animações no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const DEFAULT_COMPLEXITY = { isComplex: false, flatData: [] }

export default function TreatmentsScreen() {
  const navigation = useNavigation()
  const {
    groups,
    loading,
    error,
    stale,
    refresh,
    activeTab,
    setActiveTab,
    counts,
    pausados,
    finalizados,
  } = useTreatments()
  const [expandedGroups, setExpandedGroups] = useState({})

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

  // Heurística de Complexidade Adaptativa (Wave 10A) — APENAS ativos.
  // Pausados e finalizados vão flat (sem grupos), conforme spec Fase 2.5 §3.1.
  const { isComplex, flatData } = useMemo(() => {
    if (!groups) return DEFAULT_COMPLEXITY
    const total = groups.reduce((acc, g) => acc + g.protocols.length, 0)
    const flat = groups.flatMap(g => g.protocols)
    return { isComplex: total > 3, flatData: flat }
  }, [groups])

  const totalAcrossTabs = (counts?.ativos ?? 0) + (counts?.pausados ?? 0) + (counts?.finalizados ?? 0)
  const isFullyEmpty = totalAcrossTabs === 0

  // Refresh ao ganhar foco: captura tratamentos/planos criados em ProtocolFormScreen
  // (useTreatments cache key difere de @dosiq/protocols-snapshot invalidado pela mutation).
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh])
  )

  const toggleGroup = useCallback((groupId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedGroups(prev => {
      // Se for undefined (estado inicial), tratamos como true (aberto), então o toggle inverte para false.
      const isCurrentlyExpanded = prev[groupId] !== false
      return {
        ...prev,
        [groupId]: !isCurrentlyExpanded
      }
    })
  }, [])

  if (loading && !groups) {
    return (
      <ScreenContainer>
        <LoadingState message="Carregando seus tratamentos..." />
      </ScreenContainer>
    )
  }

  if (error && !groups) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenContainer>
    )
  }

  // Empty global (Fase 2.5): só mostra TreatmentEmptyState quando NÃO há
  // tratamentos em NENHUMA tab. Se há em outra tab, mantém TabBar e mostra
  // mensagem específica per-tab.
  const isEmpty = isFullyEmpty

  return (
    <ScreenContainer>
      {stale && <StaleBanner />}
      
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!groups}
            onRefresh={refresh}
            tintColor={colors.status.success}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tratamentos</Text>
          <Text style={styles.subtitle}>Acompanhe os tratamentos ativos</Text>
        </View>

        {/* Link Medicamentos no topo APENAS no estado zero — destaque para onboarding.
            Quando há tratamentos, o link migra para o rodapé (gestão diária = tratamentos). */}
        {isEmpty && (
          <Pressable
            onPress={goToMedicines}
            style={({ pressed }) => [styles.medicinesLink, pressed && styles.medicinesLinkPressed]}
            accessibilityRole="button"
            accessibilityLabel="Medicamentos"
          >
            <Pill size={18} color={colors.primary[700]} />
            <Text style={styles.medicinesLinkText}>Medicamentos</Text>
            <ChevronRight size={18} color={colors.primary[700]} />
          </Pressable>
        )}

        {isEmpty ? (
          <TreatmentEmptyState onCreatePress={goToCreate} />
        ) : (
          <>
            <TreatmentTabBar
              activeTab={activeTab}
              counts={counts}
              onChange={setActiveTab}
            />

            {activeTab === 'ativos' && counts.ativos === 0 ? (
              <Text style={styles.tabEmpty}>Nenhum tratamento ativo no momento.</Text>
            ) : null}

            {activeTab === 'pausados' && (
              pausados.length === 0 ? (
                <Text style={styles.tabEmpty}>Nenhum tratamento pausado.</Text>
              ) : (
                <View style={styles.simpleList}>
                  {pausados.map(protocol => (
                    <TreatmentCard
                      key={protocol.id}
                      treatment={protocol}
                      tabStatus={protocol.tabStatus}
                      endDate={protocol.endDate}
                      onPress={() => openProtocolDetail(protocol.id)}
                    />
                  ))}
                </View>
              )
            )}

            {activeTab === 'finalizados' && (
              finalizados.length === 0 ? (
                <Text style={styles.tabEmpty}>Nenhum tratamento finalizado ainda.</Text>
              ) : (
                <View style={styles.simpleList}>
                  {finalizados.map(protocol => (
                    <TreatmentCard
                      key={protocol.id}
                      treatment={protocol}
                      tabStatus={protocol.tabStatus}
                      endDate={protocol.endDate}
                      onPress={() => openProtocolDetail(protocol.id)}
                    />
                  ))}
                </View>
              )
            )}

            {activeTab === 'ativos' && counts.ativos > 0 && (
              !isComplex ? (
                /* MODO SIMPLE: Dona Maria (Lista direta sem accordions) */
                <View style={styles.simpleList}>
                  {flatData.map(protocol => (
                    <TreatmentCard
                      key={protocol.id}
                      treatment={protocol}
                      tabStatus={protocol.tabStatus}
                      endDate={protocol.endDate}
                      onPress={() => openProtocolDetail(protocol.id)}
                    />
                  ))}
                </View>
              ) : (
                /* MODO COMPLEX: Carlos (Agrupado por planos/classes) */
                groups.map(group => {
                  const isExpanded = expandedGroups[group.id] !== false
                  return (
                    <View key={group.id} style={styles.groupContainer}>
                      <TreatmentPlanHeader
                        title={group.title}
                        emoji={group.emoji}
                        color={group.color}
                        isExpanded={isExpanded}
                        onToggle={() => toggleGroup(group.id)}
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
                              onPress={() => openProtocolDetail(protocol.id)}
                            />
                          ))}
                          <Pressable
                            onPress={() => goToCreateInGroup(group.id)}
                            style={({ pressed }) => [
                              styles.addToGroup,
                              pressed && styles.addToGroupPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Adicionar tratamento ao grupo ${group.title}`}
                          >
                            <Plus size={16} color={colors.primary[700]} />
                            <Text style={styles.addToGroupText}>Adicionar tratamento ao grupo</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )
                })
              )
            )}
          </>
        )}

        {/* Link Medicamentos no rodapé quando há tratamentos — mesmo estilo do topo, só posição diferente. */}
        {!isEmpty && (
          <Pressable
            onPress={goToMedicines}
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

      {!isEmpty && (
        <Pressable
          onPress={goToCreate}
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
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    marginBottom: spacing[2],
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
