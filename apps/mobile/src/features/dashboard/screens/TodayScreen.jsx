import { useState } from 'react'
import { ScrollView, View, Text, RefreshControl, StyleSheet } from 'react-native'
import { useTodayData } from '../hooks/useTodayData'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import LoadingState from '../../../shared/components/states/LoadingState'
import EmptyState from '../../../shared/components/states/EmptyState'
import ErrorState from '../../../shared/components/states/ErrorState'
import TodaySummaryCard from '../components/TodaySummaryCard'
import UpcomingDosesList from '../components/UpcomingDosesList'
import PriorityActionCard from '../components/PriorityActionCard'
import StockAlertInline from '../components/StockAlertInline'
import DoseRegisterModal from '../../dose/components/DoseRegisterModal'

export default function TodayScreen() {
  const [modalProtocol, setModalProtocol] = useState(null)
  const [modalScheduledTime, setModalScheduledTime] = useState(null)

  const { data, loading, error, stale, refresh } = useTodayData()

  if (loading && !data) return <LoadingState message="A carregar o seu dia..." />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />

  const protocols = data?.protocols ?? []
  const medicines = data?.medicines ?? {}
  const stats = data?.stats ?? { expected: 0, taken: 0, score: 0 }
  const zones = data?.zones ?? { late: [], now: [], upcoming: [], done: [] }
  const stockAlerts = data?.stockAlerts ?? []

  // Doses prioritárias: Agrupar até 3 medicamentos (Late + Now) conforme Spec H5.7.5
  const priorityDoses = [...zones.late, ...zones.now].slice(0, 3)

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
            tintColor="#005db6"
          />
        }
      >
        <TodaySummaryCard 
          totalExpected={stats.expected} 
          totalTaken={stats.taken} 
          score={stats.score} 
        />

        <StockAlertInline alerts={stockAlerts} />

        {priorityDoses.length > 0 && (
          <PriorityActionCard 
            doses={priorityDoses} 
            onPress={(d) => handleOpenRegister(d.protocol, d.scheduledTime)} 
          />
        )}

        {protocols.length === 0 ? (
          <EmptyState
            icon="💊"
            message={'Sem tratamentos activos.\nAdicione protocolos na versão web.'}
          />
        ) : (
          <UpcomingDosesList
            zones={zones}
            onRegister={handleOpenRegister}
          />
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
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: 20,
    paddingBottom: 40,
  },
  staleBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 152, 0, 0.2)',
  },
  staleText: {
    fontSize: 12,
    color: '#904d00',
    textAlign: 'center',
    fontWeight: '600',
  },
})
