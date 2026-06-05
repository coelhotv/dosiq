import React, { useMemo } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { parseISO } from '@dosiq/core'
import { ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react-native'
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
  if (status === 'taken') return <CheckCircle2 size={22} color={COLORS.teal} strokeWidth={2} />
  if (status === 'missed') return <XCircle size={22} color={COLORS.red} strokeWidth={2} />
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
        return parseISO(item.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
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
            {item.dosage_per_pill != null && item.dosage_unit ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{item.dosage_per_pill}{item.dosage_unit}</Text>
              </View>
            ) : null}
          </View>
          {item.dosage_per_intake != null && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.dosage_per_intake} {item.dosage_per_intake === 1 ? 'comprimido' : 'comprimidos'}
            </Text>
          )}
        </View>
        <ChevronRight size={16} color={COLORS.gray} strokeWidth={1.5} />
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>Nada por aqui</Text>
    </View>
  )

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item, index) => item.id ?? index.toString()}
      renderItem={renderItem}
      ListEmptyComponent={renderEmpty}
      scrollEnabled={false}
      style={styles.list}
      contentContainerStyle={sorted.length === 0 ? styles.emptyContent : undefined}
    />
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
