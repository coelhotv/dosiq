// MeasureValueFields — miolo do registro de medida (069 A1, extraído do MeasureLogSheet).
// Valor gigante centrado (PA = sistólica "por" diastólica) + unidade fixa por tipo + erro inline.
// A vírgula PT-BR é aceita como digitada; a conversão (coerceDecimal) fica com quem salva.
// autoFocus: default true (comportamento do MeasureLogSheet). O passo 2 da dose (069 A2) passa false.
// SaMD (ADR-062): nenhuma cor/copy de qualidade do valor — vermelho só no erro de digitação.

import { View, Text, TextInput, StyleSheet } from 'react-native'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default function MeasureValueFields({
  unit,
  isPa,
  value,
  onChangeValue,
  valueSec,
  onChangeValueSec,
  errorMsg,
  autoFocus = true,
}) {
  return (
    <>
      <View style={styles.valueRow}>
        <View style={styles.paField}>
          <TextInput
            style={[isPa ? styles.paInput : styles.valueInput, errorMsg && styles.valueInputError]}
            value={value}
            onChangeText={onChangeValue}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.neutral[300]}
            maxLength={isPa ? 3 : 6}
            autoFocus={autoFocus}
            accessibilityLabel={isPa ? 'Sistólica em mmHg' : `Valor da medida em ${unit}`}
          />
          {isPa && <Text style={styles.paFieldLabel}>Sistólica</Text>}
        </View>
        {isPa && (
          <>
            <Text style={styles.paSep}>por</Text>
            <View style={styles.paField}>
              <TextInput
                style={[styles.paInput, errorMsg && styles.valueInputError]}
                value={valueSec}
                onChangeText={onChangeValueSec}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.neutral[300]}
                maxLength={3}
                accessibilityLabel="Diastólica em mmHg"
              />
              <Text style={styles.paFieldLabel}>Diastólica</Text>
            </View>
          </>
        )}
        <Text style={styles.unit}>{unit}</Text>
      </View>

      <Text style={[styles.caption, !errorMsg && styles.captionHidden]}>{errorMsg || ' '}</Text>
    </>
  )
}

const styles = StyleSheet.create({
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing[2] },
  valueInput: {
    fontSize: 64, fontWeight: '700', color: colors.text.primary, textAlign: 'center', minWidth: 120,
    padding: 0, fontFamily: typography.fontFamily.bold,
  },
  valueInputError: { color: colors.status.error },
  unit: { fontSize: 22, fontWeight: '600', color: colors.text.muted },
  // PA — 2 campos (sistólica "por" diastólica), unidade à direita. Reusa valueRow no container.
  paField: { alignItems: 'center' },
  paInput: {
    fontSize: 48, fontWeight: '700', color: colors.text.primary, textAlign: 'center', minWidth: 72,
    padding: 0, fontFamily: typography.fontFamily.bold,
  },
  paFieldLabel: { fontSize: 12, color: colors.text.muted, marginTop: spacing[1] },
  paSep: { fontSize: 20, fontWeight: '600', color: colors.text.muted },
  caption: { fontSize: 12, color: colors.status.error, textAlign: 'center', marginTop: spacing[1], minHeight: 16 },
  captionHidden: { opacity: 0 },
})
