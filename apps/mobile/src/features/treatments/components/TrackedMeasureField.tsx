// TrackedMeasureField.tsx — "Acompanhar nas doses" no form do tratamento (spec 100 B · FR-004).
//
// Campo do form, não etapa nem modal (FR-004). Sempre visível e trocável, "Nenhum" sempre disponível
// (D-2). A pré-seleção sem toque vem da inferência (`displayedTrackedMeasure`) e segue o medicamento e a
// frequência; tocar fixa a escolha (INV-1). Mesmo desenho de chip de rádio do SchedulePresetSection.
// Informativo (ADR-062): diz o que o app vai pedir, nunca por quê clinicamente.

import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { TrackedMeasure } from '@dosiq/core'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { TRACKED_MEASURE_OPTIONS } from '@treatments/utils/trackedMeasureField'

type Props = {
  value: TrackedMeasure
  onChange: (next: TrackedMeasure) => void
}

const HINT: Record<TrackedMeasure, string> = {
  peso: 'Depois da dose, o app pede o peso no máximo 1 vez por semana.',
  glicemia: 'Depois da dose, o app pede a glicemia no máximo 2 vezes por dia (manhã e tarde).',
  pressao_arterial: 'Depois da dose, o app pede a pressão no máximo 1 vez por dia e 3 por semana.',
  nenhum: 'O app não pede medida depois das doses deste tratamento.',
}

export default function TrackedMeasureField({ value, onChange }: Props) {
  return (
    <View>
      <View style={styles.chips} accessibilityRole="radiogroup" testID="tracked-measure">
        {TRACKED_MEASURE_OPTIONS.map((option) => {
          const checked = option.value === value
          return (
            <Pressable
              key={option.value}
              onPress={() => { selectionTap(); onChange(option.value) }}
              style={({ pressed }) => [styles.chip, checked && styles.chipActive, pressed && styles.chipPressed]}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={option.label}
              testID={`tracked-measure-${option.value}`}
            >
              <Text style={[styles.chipText, checked && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.hint}>{HINT[value]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    minHeight: 48, justifyContent: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    borderRadius: borderRadius.full, backgroundColor: colors.neutral[100],
  },
  chipActive: { backgroundColor: colors.primary[50], borderWidth: 1, borderColor: colors.primary[700] },
  chipPressed: { opacity: 0.7 },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  chipTextActive: { color: colors.primary[700], fontWeight: '700', fontFamily: typography.fontFamily.bold },
  hint: { fontSize: 13, color: colors.text.secondary, marginTop: spacing[2] },
})
