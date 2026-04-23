import { useState, useCallback } from 'react'
import { ScrollView, View, Text, StyleSheet, RefreshControl, LayoutAnimation, Platform, UIManager } from 'react-native'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import LoadingState from '../../../shared/components/states/LoadingState'
import ErrorState from '../../../shared/components/states/ErrorState'
import EmptyState from '../../../shared/components/states/EmptyState'
import TreatmentCard from '../components/TreatmentCard'
import TreatmentPlanHeader from '../components/TreatmentPlanHeader'
import { useTreatments } from '../hooks/useTreatments'
import { colors, spacing, typography } from '../../../shared/styles/tokens'
import StaleBanner from '../../../shared/components/feedback/StaleBanner'

// Habilitar animações no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function TreatmentsScreen() {
  const { data: groups, loading, error, stale, refresh } = useTreatments()
  const [expandedGroups, setExpandedGroups] = useState({})

  const toggleGroup = useCallback((groupId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }, [])

  // Heurística de Complexidade Adaptativa (Wave 10A)
  const { isComplex, flatData } = useMemo(() => {
    if (!groups) return { isComplex: false, flatData: [] }
    const total = groups.reduce((acc, g) => acc + g.protocols.length, 0)
    const flat = groups.flatMap(g => g.protocols)
    return { isComplex: total > 3, flatData: flat }
  }, [groups])

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

  // Se não houver grupos, mostrar EmptyState
  const isEmpty = !groups || groups.length === 0

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
          <Text style={styles.title}>Meus Tratamentos</Text>
          <Text style={styles.subtitle}>Acompanhe seus protocolos ativos</Text>
        </View>

        {isEmpty ? (
          <EmptyState 
            title="Nenhum tratamento ativo"
            message={'Sem tratamentos ativos.\nAdicione protocolos na versão web.'}
          />
        ) : !isComplex ? (
          /* MODO SIMPLE: Dona Maria (Lista direta sem accordions) */
          <View style={styles.simpleList}>
            {flatData.map(protocol => (
              <TreatmentCard 
                key={protocol.id} 
                treatment={protocol} 
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
                      />
                    ))}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing[10],
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 8,
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
    marginTop: 4,
    fontFamily: typography.fontFamily.medium || 'System',
  },
  groupContainer: {
    marginBottom: spacing[2],
  },
  protocolsList: {
    marginTop: spacing[1],
  },
  simpleList: {
    paddingTop: spacing[2],
  },
})
