// StockFilterChips.jsx — chips de filtro horizontais para o hub de estoque (S1.8 Wave 4)
// ADR-028: StyleSheet canônico · ADR-023: fontWeight >= 400 · sem cores hardcoded
//
// Contrato: { value, onChange, counts }
//   value: 'todos' | 'critico' | 'baixo' | 'sem_tratamento'
//   onChange(nextValue): callback ao tocar num chip
//   counts: { todos, critico, baixo, sem_tratamento } (números)
//
// "vencendo" fora de escopo Wave 4 (exige dado de validade não carregado no hub).

import { ScrollView, Pressable, Text, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'critico', label: 'Crítico' },
  { key: 'baixo', label: 'Baixo' },
  { key: 'sem_tratamento', label: 'Sem tratamento' },
]

/**
 * Chips de filtro do hub de estoque.
 */
export default function StockFilterChips({ value, onChange, counts = {} }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {FILTERS.map((f) => {
        const selected = value === f.key
        const count = counts[f.key] ?? 0
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[styles.chip, selected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Filtrar por ${f.label}`}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {f.label} ({count})
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  chipSelected: {
    backgroundColor: colors.primary[100],
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.medium || 'System',
  },
  chipTextSelected: {
    color: colors.primary[700],
    fontWeight: '700',
  },
})
