// DoseListItem.jsx — item de protocolo/dose na lista da tela Hoje
// Mostra: nome do medicamento, horários, se já foi tomado hoje

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * @param {{
 *   protocol: Object,
 *   medicine: Object,
 *   takenCount: number,   — quantas doses tomadas hoje
 *   onRegister: Function  — abre o modal de registo
 * }} props
 */
export default function DoseListItem({ protocol, medicine, takenCount, onRegister }) {
  const scheduleStr = protocol.time_schedule?.join(', ') ?? '—'
  const expectedCount = protocol.time_schedule?.length ?? 1
  const isFull = takenCount >= expectedCount

  return (
    <View style={[styles.card, isFull && styles.cardDone]}>
      <View style={styles.info}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>{medicine?.name ?? 'Medicamento'}</Text>
          {medicine?.dosage_per_pill && (
            <View style={styles.dosagePill}>
              <Text style={styles.dosagePillText}>
                {medicine.dosage_per_pill}{medicine.dosage_unit}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.schedule}>🕐 {scheduleStr}</Text>
        <Text style={styles.dosage}>
          {protocol.dosage_per_intake} unidade{protocol.dosage_per_intake !== 1 ? 's' : ''} · {takenCount}/{expectedCount} tomado{takenCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {!isFull && (
        <Pressable style={styles.ctaButton} onPress={() => onRegister(protocol)}>
          <Text style={styles.ctaText}>Tomar</Text>
        </Pressable>
      )}
      {isFull && (
        <View style={styles.doneBadge}>
          <Text style={styles.doneText}>✓ Feito</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing[3],
  },
  cardDone: {
    opacity: 0.6,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    flexShrink: 1,
  },
  dosagePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  schedule: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  dosage: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  ctaButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  doneBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.status.success + '22',
  },
  doneText: {
    color: colors.status.success,
    fontSize: 13,
    fontWeight: '600',
  },
})
