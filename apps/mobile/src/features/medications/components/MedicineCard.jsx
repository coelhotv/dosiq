// MedicineCard.jsx — card de medicamento (Sprint M1.1 Fase 1)

import { Pressable, View, Text, StyleSheet } from 'react-native'
import { Pill, PillBottle } from 'lucide-react-native'
import { colors, spacing, borderRadius, shadows, typography } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'

const ICON_WRAP_SIZE = 32

export default function MedicineCard({ medicine, onPress }) {
  const {
    name,
    type,
    dosage_per_pill,
    dosage_unit,
    active_ingredient,
    protocols_count = 0,
  } = medicine ?? {}

  const isSupplement = type === 'suplemento'
  const Icon = isSupplement ? PillBottle : Pill
  const iconColor = isSupplement ? colors.supplement[500] : colors.primary[500]
  const iconBg = isSupplement ? colors.supplement[50] : colors.primary[50]

  const handlePress = () => {
    selectionTap()
    onPress?.()
  }

  const hasDose = dosage_per_pill != null && dosage_unit
  const protocolsLabel =
    protocols_count > 0
      ? `${protocols_count} ${protocols_count === 1 ? 'tratamento associado' : 'tratamentos associados'}`
      : 'Sem tratamentos associados'

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Medicamento ${name}`}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Icon size={20} color={iconColor} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {hasDose && (
          <View style={styles.dosagePill}>
            <Text style={styles.dosagePillText}>
              {dosage_per_pill}{dosage_unit}
            </Text>
          </View>
        )}
      </View>

      {active_ingredient ? (
        <Text style={styles.meta} numberOfLines={1}>
          {active_ingredient}
        </Text>
      ) : null}

      <Text style={styles.protocols}>{protocolsLabel}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginVertical: spacing[2],
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconWrap: {
    width: ICON_WRAP_SIZE,
    height: ICON_WRAP_SIZE,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  dosagePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosagePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  meta: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: spacing[1],
    marginLeft: ICON_WRAP_SIZE + spacing[3],
  },
  protocols: {
    marginTop: spacing[2],
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
})
