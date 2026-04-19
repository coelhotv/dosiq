import { View, Text, StyleSheet } from 'react-native'
import { TrendingUp } from 'lucide-react-native'
import AdherenceRing from './AdherenceRing'

/**
 * AdherenceDayCard - Card de status diário/semanal para o Dashboard (Epic 2)
 * @param {Object} props
 * @param {number} props.score - Percentual de adesão 0-100
 * @param {string} props.trend - Ex: "10% acima da média"
 */
export default function AdherenceDayCard({ score = 0, trend = '' }) {
  // Copy dinâmico baseado no score (Thresholds R-129)
  const getMotivationalText = (s) => {
    if (s >= 90) return 'Você está indo muito bem hoje!'
    if (s >= 70) return 'Algumas doses perdidas. Dá para recuperar!'
    return 'Tratamento em risco. Vamos retomar?'
  }

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.title}>Adesão (Últimos 7 dias)</Text>
          <Text style={styles.description}>{getMotivationalText(score)}</Text>
          
          {trend ? (
            <View style={styles.trendContainer}>
              <TrendingUp size={16} color="#006a5e" style={styles.trendIcon} />
              <Text style={styles.trendText}>{trend}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.right}>
          <AdherenceRing score={score} size={80} strokeWidth={8} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff', // surface_container_lowest
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    // Ambient Shadow
    shadowColor: '#1a1c1e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  right: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1e',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#44474e',
    lineHeight: 20,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  trendIcon: {
    marginRight: 4,
  },
  trendText: {
    fontSize: 13,
    color: '#006a5e', // primary
    fontWeight: '600',
  },
})
