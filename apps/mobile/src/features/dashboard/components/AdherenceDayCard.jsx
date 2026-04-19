import { View, Text, StyleSheet } from 'react-native'
import { TrendingUp } from 'lucide-react-native'
import AdherenceRing from './AdherenceRing'
import { colors, spacing, borderRadius, shadows } from '../../../shared/styles/tokens'

/**
 * AdherenceDayCard - Card de status diário/semanal para o Dashboard (Epic 2)
 * @param {Object} props
 * @param {number} props.score - Percentual de adesão 0-100
 * @param {string} props.trend - Ex: "10% acima da média"
 */
export default function AdherenceDayCard({ score = 0, trend = '' }) {
  // Copy dinâmico baseado no score (Thresholds R-156)
  const getMotivationalText = (s) => {
    if (s === 0) return 'Comece hoje mesmo seu tratamento'
    if (s >= 90) return 'Tratamento em dia. Continue assim!'
    if (s >= 70) return 'Algumas doses perdidas. Está quase lá!'
    if (s >= 50) return 'Tratamento em risco. Você consegue!'
    return 'Muitas doses perdidas. Vamos retomar?'
  }

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.left}>
          <Text style={styles.title}>Adesão (Últimos 7 dias)</Text>
          <Text style={styles.description}>{getMotivationalText(score)}</Text>
          
          {trend ? (
            <View style={styles.trendContainer}>
              <TrendingUp size={16} color={colors.primary[500]} style={styles.trendIcon} />
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
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    paddingRight: spacing[3],
  },
  right: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  trendIcon: {
    marginRight: spacing[1],
  },
  trendText: {
    fontSize: 13,
    color: colors.primary[500],
    fontWeight: '600',
  },
})
