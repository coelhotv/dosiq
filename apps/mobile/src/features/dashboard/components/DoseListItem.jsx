// DoseListItem.jsx — item de protocolo/dose na lista da tela Hoje
// Mostra: nome do medicamento, horários, se já foi tomado hoje

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * @param {{
 *   protocol: Object,
 *   medicineName: string,
 *   takenCount: number,   — quantas vezes foi registado hoje
 *   onRegister: Function  — abre o modal de registo
 * }} props
 */
export default function DoseListItem({ protocol, medicineName, takenCount, onRegister }) {
  const scheduleStr = protocol.time_schedule?.join(', ') ?? '—'
  const expectedCount = protocol.time_schedule?.length ?? 1
  const isFull = takenCount >= expectedCount

  return (
    <View style={[styles.card, isFull && styles.cardDone]}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{medicineName}</Text>
        <Text style={styles.schedule}>🕐 {scheduleStr}</Text>
        <Text style={styles.dosage}>
          {protocol.dosage_per_intake} cp · {takenCount}/{expectedCount} registado{takenCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {!isFull && (
        <Pressable style={styles.ctaButton} onPress={() => onRegister(protocol)}>
          <Text style={styles.ctaText}>Registar</Text>
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
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
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
