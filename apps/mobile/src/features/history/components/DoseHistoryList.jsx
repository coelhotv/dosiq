import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { parseISO, formatConcentration, isLiquidMedicine, formatDose } from '@dosiq/core'
import { ChevronRight, CircleCheckBig, XCircle, Clock, RedoDot } from 'lucide-react-native'
import { colors, spacing } from '@shared/styles/tokens'

const COLORS = {
  teal: colors.brand.primary,
  red: colors.status.error,
  gray: colors.neutral[400],
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  card: colors.bg.card,
  background: colors.bg.screen,
  border: colors.border.light,
}

function StatusIcon({ status }) {
  if (status === 'taken') return <CircleCheckBig size={22} color={COLORS.teal} strokeWidth={2} />
  if (status === 'missed') return <XCircle size={22} color={COLORS.red} strokeWidth={2} />
  if (status === 'skipped_user') return <RedoDot size={22} color={COLORS.gray} strokeWidth={2} />
  return <Clock size={22} color={COLORS.gray} strokeWidth={2} />
}

export default function DoseHistoryList({ instances = [], timezone = 'America/Sao_Paulo', onItemPress }) {
  const sorted = useMemo(() => (
    [...instances].sort((a, b) => parseISO(a.scheduled_for) - parseISO(b.scheduled_for))
  ), [instances])

  const renderItem = ({ item, index }) => {
    const timeStr = (() => {
      try {
        return new Intl.DateTimeFormat('pt-BR', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
        }).format(parseISO(item.scheduled_for))
      } catch {
        const d = parseISO(item.scheduled_for)
        const hh = String(d.getHours()).padStart(2, '0')
        const min = String(d.getMinutes()).padStart(2, '0')
        return `${hh}:${min}`
      }
    })()

    const medicineName = item.medicine_name || item.protocol_name || '—'
    const isLast = index === sorted.length - 1

    return (
      <TouchableOpacity
        style={[styles.item, !isLast && styles.itemBorder]}
        onPress={() => onItemPress?.(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.time}>{timeStr}</Text>
        <StatusIcon status={item.status} />
        <View style={styles.itemBody}>
          <View style={styles.nameRow}>
            <Text style={styles.medicineName} numberOfLines={1}>{medicineName}</Text>
            {item.is_orphan && (
              <View style={styles.pillOrphan}>
                <Text style={styles.pillOrphanText}>avulsa</Text>
              </View>
            )}
            {item.dosage_per_pill != null && item.dosage_unit ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{formatConcentration(item.dosage_per_pill, item.dosage_unit)}</Text>
              </View>
            ) : null}
          </View>
          {item.dosage_per_intake != null && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {(() => {
                const qty = item.dosage_per_intake
                // Líquido (022): unidade de TOMADA do tratamento (gotas/ml/UI), não a
                // unidade do medicamento — ex: "10 UI", nunca "10 ui/ml".
                if (isLiquidMedicine(item)) return formatDose(qty, item.intake_unit || 'ml')
                const unit = item.dosage_unit?.toLowerCase()
                if (!unit || ['mg', 'mcg', 'g'].includes(unit)) return `${qty} ${qty === 1 ? 'comprimido' : 'comprimidos'}`
                if (unit === 'un') return `${qty} ${qty === 1 ? 'unidade' : 'unidades'}`
                return `${qty} ${item.dosage_unit}`
              })()}
            </Text>
          )}
        </View>
        <ChevronRight size={16} color={COLORS.gray} strokeWidth={1.5} />
      </TouchableOpacity>
    )
  }

  if (sorted.length === 0) {
    return (
      <View style={[styles.list, styles.emptyContent]}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nada por aqui</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.list}>
      {sorted.map((item, index) => (
        <React.Fragment key={item.id ?? index.toString()}>
          {renderItem({ item, index })}
        </React.Fragment>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemBorder: {
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
  itemBody: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  medicineName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  pill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  pillOrphan: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.brand.primary,
  },
  pillOrphanText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContent: {
    flex: 1,
  },
})
