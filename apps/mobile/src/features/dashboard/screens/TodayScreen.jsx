// TodayScreen.jsx — tela principal do MVP mobile (H5.2 + H5.3)
// Padrão: loading → error (sem cache) → dados (com stale banner se offline)
// R5-003: registo de dose é o CTA principal
// R5-008: stale state visível quando refresh falha com snapshot local

import { useState } from 'react'
import { ScrollView, View, Text, RefreshControl, StyleSheet } from 'react-native'
import { useTodayData } from '../hooks/useTodayData'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import LoadingState from '../../../shared/components/states/LoadingState'
import EmptyState from '../../../shared/components/states/EmptyState'
import ErrorState from '../../../shared/components/states/ErrorState'
import TodaySummaryCard from '../components/TodaySummaryCard'
import UpcomingDosesList from '../components/UpcomingDosesList'
import DoseRegisterModal from '../../dose/components/DoseRegisterModal'
import { colors, spacing } from '../../../shared/styles/tokens'

export default function TodayScreen() {
  // States primeiro (R-010)
  const [modalProtocol, setModalProtocol] = useState(null)

  const { data, loading, error, stale, refresh } = useTodayData()

  // Carregamento inicial sem snapshot
  if (loading && !data) return <LoadingState message="A carregar o seu dia..." />

  // Erro sem nenhum snapshot em cache
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />

  const protocols = data?.protocols ?? []
  const logs = data?.logs ?? []
  const medicineNames = data?.medicineNames ?? {}

  // Calcular totais para o card de resumo
  const totalExpected = protocols.reduce((sum, p) => sum + (p.time_schedule?.length ?? 1), 0)
  const totalTaken = logs.reduce((acc, log) => acc + (log.quantity_taken ?? 0), 0)

  function handleRegisterSuccess() {
    console.log('[TodayScreen] dose registada — a fechar modal e a fazer refresh')
    setModalProtocol(null)
    refresh()
  }

  return (
    <ScreenContainer>
      {/* Banner de dados antigos (stale) */}
      {stale && (
        <View style={styles.staleBanner}>
          <Text style={styles.staleText}>⚠️ Sem ligação — a mostrar dados anteriores</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!data}
            onRefresh={refresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        <TodaySummaryCard totalExpected={totalExpected} totalTaken={totalTaken} />

        {protocols.length === 0 ? (
          <EmptyState
            icon="💊"
            message={'Sem tratamentos activos.\nAdicione protocolos na versão web.'}
          />
        ) : (
          <UpcomingDosesList
            protocols={protocols}
            logs={logs}
            medicineNames={medicineNames}
            onRegister={setModalProtocol}
          />
        )}
      </ScrollView>

      <DoseRegisterModal
        visible={modalProtocol !== null}
        protocol={modalProtocol}
        medicineName={modalProtocol ? (medicineNames[modalProtocol.medicine_id] ?? 'Medicamento') : ''}
        onClose={() => setModalProtocol(null)}
        onSuccess={handleRegisterSuccess}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  staleBanner: {
    backgroundColor: colors.status.warning + '22',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.status.warning + '44',
  },
  staleText: {
    fontSize: 12,
    color: colors.status.warning,
    textAlign: 'center',
    fontWeight: '500',
  },
})
