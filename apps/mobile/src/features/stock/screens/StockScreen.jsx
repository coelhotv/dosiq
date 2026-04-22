import React, { useMemo } from 'react'
import { SectionList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useStock } from '@stock/hooks/useStock'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import LoadingState from '../../../shared/components/states/LoadingState'
import EmptyState from '../../../shared/components/states/EmptyState'
import ErrorState from '../../../shared/components/states/ErrorState'
import StockItem from '../components/StockItem'
import StaleBanner from '../../../shared/components/feedback/StaleBanner'

/**
 * Tela principal de Gerenciamento de Estoque (H5.5).
 */
export default function StockScreen() {
  const { data, loading, error, stale, refreshing, refresh } = useStock()

  // Formata os dados no formato esperado pelo SectionList
  const sections = useMemo(() => {
    if (!data) return []
    const list = []
    
    if (data?.active?.length > 0) {
      list.push({
        title: 'Estoque em Uso',
        data: data.active
      })
    }
    
    if (data?.inactive?.length > 0) {
      list.push({
        title: 'Sem tratamento ativo',
        data: data.inactive
      })
    }
    
    return list
  }, [data])

  if (loading && !refreshing) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    )
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <ErrorState 
          message="Não foi possível carregar seu estoque." 
          onRetry={refresh} 
        />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {stale && <StaleBanner />}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <StockItem medicine={item} />}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={refresh} 
            tintColor="#6366f1"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Meu Estoque</Text>
            <Text style={styles.subtitle}>
              Acompanhe a disponibilidade dos seus medicamentos
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState 
            message="Você não possui medicamentos cadastrados ou estoque registrado." 
          />
        }
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 40
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
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 4,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f9fafb'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  }
})
