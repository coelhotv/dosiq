// BiomarkerHistoryCard.jsx — card de biomarcador no histórico do dia (spec 033, FR-004).
// Tap abre MeasureDetailSheet (padrão idêntico ao DoseActionSheet dos cards de dose).

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Ruler, ChevronRight } = LucideIcons as any
import { BIOMARKER_TYPE_LABELS, BIOMARKER_TYPE_UNITS, parseISO } from '@dosiq/core'
import { colors } from '@shared/styles/tokens'

const COLORS = {
  card: colors.bg.card,
  border: colors.border.light,
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  accent: colors.brand.primary,
  gray: colors.neutral[400],
}

export default function BiomarkerHistoryCard({ item, timezone = 'America/Sao_Paulo', onPress, isLast = false }) {
  const label = BIOMARKER_TYPE_LABELS[item.bioType] ?? item.bioType
  const unit  = item.unit ?? BIOMARKER_TYPE_UNITS[item.bioType] ?? ''

  const timeStr = (() => {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
      }).format(parseISO(item.measured_at))
    } catch {
      return item.measured_at?.slice(11, 16) ?? '—'
    }
  })()

  const valueStr = item.value_secondary != null
    ? `${item.value}/${item.value_secondary} ${unit}`
    : `${item.value} ${unit}`

  return (
    <TouchableOpacity
      style={[styles.card, !isLast && styles.cardBorder]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.time}>{timeStr}</Text>
      <Ruler size={22} color={COLORS.accent} strokeWidth={2} />
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{valueStr}</Text>
      </View>
      <ChevronRight size={16} color={COLORS.gray} strokeWidth={1.5} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  cardBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  time: {
    width: 40,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  value: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
})
