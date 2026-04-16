// TreatmentsScreen.jsx — tela "Tratamentos" do MVP mobile
// Exibe a lista de protocolos ativos do usuário

import { FlatList, View, Text, StyleSheet } from 'react-native'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import LoadingState from '../../../shared/components/states/LoadingState'
import ErrorState from '../../../shared/components/states/ErrorState'
import EmptyState from '../../../shared/components/states/EmptyState'
import TreatmentCard from '../components/TreatmentCard'
import { useTreatments } from '../hooks/useTreatments'
import { colors, spacing } from '../../../shared/styles/tokens'
import StaleBanner from '../../../shared/components/feedback/StaleBanner'

export default function TreatmentsScreen() {
  const { data, loading, error, stale, refresh } = useTreatments()

  if (loading && !data) {
    return (
      <ScreenContainer>
        <LoadingState message="Carregando seus tratamentos..." />
      </ScreenContainer>
    )
  }

  if (error && !data) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={refresh} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      {stale && <StaleBanner />}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TreatmentCard treatment={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Meus Tratamentos</Text>
            <Text style={styles.subtitle}>Acompanhe seus protocolos ativos</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState 
            title="Nenhum tratamento ativo"
            message="Você não possui protocolos de tratamento configurados no momento."
          />
        }
        refreshing={loading}
        onRefresh={refresh}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  header: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
  },
})
