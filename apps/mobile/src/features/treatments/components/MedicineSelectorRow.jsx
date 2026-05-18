// MedicineSelectorRow — row de seleção de medicamento (Fase 2 T2.3)
// (componente puro controlado)
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Plus, ChevronRight, Pill, PillBottle } from 'lucide-react-native'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

export default function MedicineSelectorRow({ medicine, onPress, error }) {
  const isEmpty = medicine == null
  const isSupplement = !isEmpty && medicine.type === 'suplemento'
  const LeadingIcon = isEmpty ? Plus : isSupplement ? PillBottle : Pill

  const leadingBg = isEmpty
    ? colors.neutral[100]
    : isSupplement
      ? colors.supplement[50]
      : colors.primary[50]

  const leadingColor = isEmpty
    ? colors.primary[600]
    : isSupplement
      ? colors.supplement[500]
      : colors.primary[500]

  const subtitleText = isEmpty
    ? 'Escolha da biblioteca ou cadastre um novo'
    : medicine.laboratory || medicine.active_ingredient || ''

  const dosageLabel =
    !isEmpty && medicine.dosage_per_pill
      ? `${medicine.dosage_per_pill}${medicine.dosage_unit || ''}`
      : null

  const accessibilityLabel = isEmpty
    ? 'Selecionar medicamento'
    : `Trocar medicamento ${medicine.name}`

  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.card, isEmpty ? styles.cardEmpty : styles.cardSelected]}
      >
        <View style={[styles.leading, { backgroundColor: leadingBg }]}>
          <LeadingIcon size={isEmpty ? 20 : 22} color={leadingColor} />
        </View>

        <View style={styles.middle}>
          {isEmpty ? (
            <>
              <Text style={styles.title}>Selecionar medicamento</Text>
              <Text style={styles.subtitle}>{subtitleText}</Text>
            </>
          ) : (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {medicine.name}
                </Text>
                {dosageLabel ? (
                  <View style={styles.dosagePill}>
                    <Text style={styles.dosagePillText}>{dosageLabel}</Text>
                  </View>
                ) : null}
              </View>
              {subtitleText ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitleText}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {isEmpty ? (
          <ChevronRight size={22} color={colors.text.secondary} />
        ) : (
          <Text style={styles.trailingAction}>Trocar</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.md,
  },
  cardEmpty: {
    backgroundColor: colors.primary[50],
  },
  cardSelected: {
    backgroundColor: colors.bg.screen,
  },
  leading: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.regular,
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
    fontFamily: typography.fontFamily.medium,
  },
  trailingAction: {
    color: colors.primary[700],
    fontWeight: '700',
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
  },
  errorText: {
    color: colors.status.error,
    fontSize: 12,
    marginTop: spacing[2],
    fontFamily: typography.fontFamily.regular,
  },
})
