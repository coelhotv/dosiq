// MeasureCard.jsx — card de registro de biomarcador (012 Fase C · FR-011).
// Dois variantes:
//   - "hub" (default): card tintado plano com avatar Ruler (Histórico de Medidas).
//   - "timeline": espelha o DoseTimelineCard (horário à esquerda, conteúdo central, chevron),
//     mesmas margens/padding, fundo tintado p/ diferenciar de dose (tinta=registro, ADR-062).
// SaMD (ADR-062): cor diferencia TIPO de evento (medida), nunca qualidade do valor.

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ruler, ChevronRight } from 'lucide-react-native'
import { biomarkerCardLabel, formatBiomarkerContext, formatBiomarkerDisplay, formatDateTimeShortPtBR, formatTimePtBR } from '@dosiq/core'
import { colors, spacing, borderRadius, typography, shadows } from '@shared/styles/tokens'

// Display "S por D unit" (PA) / "V unit" (demais) — helper core (fonte única, 032).
const formatMeasure = formatBiomarkerDisplay

// Variante timeline — mesma estrutura visual do DoseTimelineCard (FR-011).
// Sem chevron/tap: é só listagem (como dose já tomada). Contexto no subtexto (sem origem).
function TimelineLayout({ item, label }) {
  const ctx = formatBiomarkerContext(item.context)
  return (
    <View style={styles.tlCard}>
      <View style={styles.tlTime}>
        <Text style={styles.tlTimeText}>{formatTimePtBR(item.measured_at)}</Text>
      </View>
      <View style={styles.tlInfo}>
        <View style={styles.tlTitleRow}>
          <Ruler size={14} color={colors.status.info} strokeWidth={2} />
          <Text style={styles.tlTitle} numberOfLines={1}>
            {label}: {formatMeasure(item)}
          </Text>
        </View>
        {ctx ? <Text style={styles.tlMeta}>{ctx}</Text> : null}
      </View>
    </View>
  )
}

// Variante hub — card tintado plano (avatar Ruler).
function HubLayout({ item, label, showLabel, showChevron }) {
  const ctx = formatBiomarkerContext(item.context)
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ruler size={18} color={colors.status.info} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <Text style={styles.value}>
          {showChevron ? `${label}: ${formatMeasure(item)}` : formatMeasure(item)}
        </Text>
        <Text style={styles.meta}>
          {showLabel && !showChevron ? label : ''}{showLabel && !showChevron && ctx ? ' · ' : ''}{ctx || ''}
          {((showLabel && !showChevron) || ctx) ? ' · ' : ''}{formatDateTimeShortPtBR(item.measured_at)}
        </Text>
      </View>
      {showChevron ? <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} /> : null}
    </View>
  )
}

export default function MeasureCard({
  item,
  onPress,
  showLabel = true,
  showChevron = false,
  variant = 'hub',
}) {
  const label = biomarkerCardLabel(item.type)

  const content = variant === 'timeline'
    ? <TimelineLayout item={item} label={label} />
    : <HubLayout item={item} label={label} showLabel={showLabel} showChevron={showChevron} />

  if (!onPress) return content
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={`Medida ${label} ${formatMeasure(item)}`}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // ----- Hub (plano, avatar) -----
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.status.infoLight,
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 36, height: 36, borderRadius: borderRadius.full,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  value: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  meta: { fontSize: 12, color: colors.text.secondary },

  // ----- Timeline (espelha DoseTimelineCard) -----
  tlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.infoLight,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    ...shadows.xs,
  },
  tlTime: { width: 60 },
  tlTimeText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.regular || 'System',
  },
  tlInfo: { flex: 1, paddingLeft: 4, gap: 2 },
  tlTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tlTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.regular || 'System',
  },
  tlMeta: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.regular || 'System',
  },
})
