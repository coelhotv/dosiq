import { useState, useMemo } from 'react'
import { ScrollView, View, Text, RefreshControl, StyleSheet } from 'react-native'
import { Pill } from 'lucide-react-native'
import { useTodayData } from '../hooks/useTodayData'
import ScreenContainer from '../../../shared/components/ui/ScreenContainer'
import LoadingState from '../../../shared/components/states/LoadingState'
import EmptyState from '../../../shared/components/states/EmptyState'
import ErrorState from '../../../shared/components/states/ErrorState'
import { getPeriodFromTime } from '@meus-remedios/core'
import AdherenceDayCard from '../components/AdherenceDayCard'
import TimeBlockSeparator from '../components/TimeBlockSeparator'
import DoseTimelineCard from '../components/DoseTimelineCard'
import HeroDoseCard from '../components/HeroDoseCard'
import StockAlertInline from '../components/StockAlertInline'
import DoseRegisterModal from '../../dose/components/DoseRegisterModal'
import StaleBanner from '../../../shared/components/feedback/StaleBanner'

export default function TodayScreen() {
  const [modalProtocol, setModalProtocol] = useState(null)
  const [modalScheduledTime, setModalScheduledTime] = useState(null)

  const { data, loading, error, stale, isDaySegregated, refresh } = useTodayData()

  const timeline = data?.timeline ?? []
  const stockAlerts = data?.stockAlerts ?? []
  const protocols = data?.protocols ?? []
  const medicines = data?.medicines ?? {}
  const stats = data?.stats ?? { expected: 0, taken: 0, score: 0 }

  // Agrupamento da Timeline por Turnos (Epic 2) - Memoized (Ref Gemini review)
  const { groupedTimeline, shifts } = useMemo(() => {
    const grouped = timeline.reduce((acc, dose) => {
      const shift = getPeriodFromTime(dose.scheduledTime)
      if (!acc[shift]) acc[shift] = []
      acc[shift].push(dose)
      return acc
    }, {})
    
    const activeShifts = ['Madrugada', 'Manhã', 'Tarde', 'Noite'].filter(s => grouped[s])
    return { groupedTimeline: grouped, shifts: activeShifts }
  }, [timeline])


  if (loading && !data) return <LoadingState message="A carregar o seu dia..." />
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />

  // Doses prioritárias (Hero)
  const priorityDoses = timeline
    .filter(d => d.timelineStatus === 'PROXIMA' || d.timelineStatus === 'ATRASADA')
    .slice(0, 3)

  // Dados do Cabeçalho (Personalização H8.7)
  const fullUserName = data?.user?.name || data?.user?.email?.split('@')[0] || 'Usuário'
  const firstName = fullUserName.trim().split(' ')[0]
  const todayFormatted = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
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
            tintColor="#006a5e"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{todayFormatted}</Text>
        </View>

        <AdherenceDayCard 
          score={stats.score} 
          trend="Dados sincronizados" // Placeholder por enquanto
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
            icon={<Pill size={48} color="#006a5e" />}
            message={'Sem tratamentos activos.\nAdicione protocolos na versão web.'}
          />
        ) : (
          shifts.map(shift => (
            <View key={shift}>
              <TimeBlockSeparator type={shift} />
              {groupedTimeline[shift].map((dose) => (
                <DoseTimelineCard 
                  key={dose.id} 
                  dose={dose} 
                  onRegister={handleOpenRegister}
                />
              ))}
            </View>
          ))
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
    paddingVertical: 10,
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
    color: '#1a1c1e',
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 16,
    color: '#74777f',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  agendaHeader: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 0,
  },
  agendaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1c1e',
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
