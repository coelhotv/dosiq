// TodaySummaryCard.jsx — card de resumo do dia na tela Hoje
// Mostra: total de doses esperadas, tomadas, e percentagem de adesão do dia

import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * @param {{
 *   totalExpected: number,
 *   totalTaken: number,
 * }} props
 */
export default function TodaySummaryCard({ totalExpected, totalTaken }) {
  const pct = totalExpected > 0 ? Math.round((totalTaken / totalExpected) * 100) : 0
  const remaining = Math.max(0, totalExpected - totalTaken)

  let statusLabel = 'Sem tratamentos activos'
  let statusColor = colors.text.muted
  if (totalExpected > 0) {
    if (pct >= 100) { statusLabel = 'Dia completo 🎉'; statusColor = colors.status.success }
    else if (pct >= 70) { statusLabel = 'Tratamento em dia'; statusColor = colors.status.success }
    else if (pct >= 40) { statusLabel = 'Algumas doses em falta'; statusColor = colors.status.warning }
    else { statusLabel = 'Várias doses em falta'; statusColor = colors.status.error }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hoje</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalTaken}</Text>
          <Text style={styles.statLabel}>tomadas</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{remaining}</Text>
          <Text style={styles.statLabel}>em falta</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: statusColor }]}>{pct}%</Text>
          <Text style={styles.statLabel}>adesão</Text>
        </View>
      </View>
      <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing[3],
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.muted,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
})
