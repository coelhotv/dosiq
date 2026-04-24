/**
 * NotificationItem — Item da Central de Avisos (Mobile).
 *
 * Título contextual por tipo (medicine_name / protocol_name).
 * CTA semântico por tipo. Status "enviada" silencioso; "falhou" mostra ícone discreto.
 * R-167: logs em __DEV__ apenas. R-138: ícone sempre com label. ADR-023: fontWeight ≥ 400.
 */
import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import {
  Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell, ChevronRight,
} from 'lucide-react-native'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import { colors } from '../../../shared/styles/tokens'

const ICON_MAP = { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell }

const CTA_MAP = {
  dose_reminder:    { label: 'Registrar dose',    action: 'dashboard' },
  stock_alert:      { label: 'Ver estoque',        action: 'stock' },
  missed_dose:      { label: 'Registrar atrasada', action: 'history' },
  titration_update: { label: 'Ver tratamento',     action: 'treatment' },
  daily_digest:     null,
}

function resolveTitle(notification, label) {
  const { notification_type, medicine_name, protocol_name } = notification
  switch (notification_type) {
    case 'dose_reminder':
    case 'stock_alert':
    case 'missed_dose':
      return medicine_name ?? label
    case 'titration_update':
      return protocol_name ?? label
    case 'daily_digest':
      return 'Resumo do dia'
    default:
      return label
  }
}

/**
 * @param {Object} props
 * @param {Object}   props.notification - Objeto notificationLog do DB
 * @param {boolean}  [props.wasTaken]   - Se dose já foi registrada (calculado pelo pai)
 * @param {function} [props.onNavigate] - (routeName) => void
 */
export default function NotificationItem({ notification, wasTaken, onNavigate }) {
  const [expanded, setExpanded] = useState(false)

  const { notification_type, status, sent_at, title, body } = notification

  const { iconName, color, bgColor, label } = getNotificationIcon(notification_type)
  const IconComponent  = ICON_MAP[iconName] ?? Bell
  const relativeTime   = formatRelativeTime(sent_at)
  const isFailed       = ['falhou', 'failed'].includes(status?.toLowerCase())
  const isDailyDigest  = notification_type === 'daily_digest'
  const isDoseReminder = notification_type === 'dose_reminder'

  const displayTitle = title ?? resolveTitle(notification, label)
  const displayBody  = body ?? null
  const cta          = CTA_MAP[notification_type] ?? null
  const hasNavAction = cta && !!onNavigate && !(isDoseReminder && wasTaken === true)

  const inner = (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
        <IconComponent size={20} color={color} strokeWidth={2} />
      </View>

      <View style={styles.body}>
        {/* Cabeçalho */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{displayTitle}</Text>
          <View style={styles.timeRow}>
            <Text style={styles.time}>{relativeTime}</Text>
            {isFailed && (
              <AlertTriangle
                size={12}
                color={colors.status?.error ?? '#dc2626'}
                strokeWidth={2.5}
                accessibilityLabel="Falhou ao enviar"
              />
            )}
          </View>
        </View>

        {/* Corpo */}
        {displayBody ? (
          <>
            <Text
              style={styles.preview}
              numberOfLines={isDailyDigest && !expanded ? 2 : undefined}
            >
              {displayBody}
            </Text>
            {isDailyDigest && (
              <Pressable
                onPress={() => setExpanded(prev => !prev)}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Ver menos' : 'Ver mais'}
                hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
              >
                <Text style={styles.expandBtn}>{expanded ? 'Ver menos' : 'Ver mais'}</Text>
              </Pressable>
            )}
          </>
        ) : null}

        {/* Rodapé: CTA ou confirmação de dose tomada */}
        <View style={styles.footer}>
          {isDoseReminder && wasTaken === true ? (
            <Text style={styles.takenLabel}>✓ Tomada</Text>
          ) : hasNavAction ? (
            <View style={styles.actionLabel}>
              <Text style={styles.actionText}>{cta.label}</Text>
              <ChevronRight size={13} color={colors.primary?.[600] ?? '#006a5e'} strokeWidth={2.5} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )

  if (hasNavAction) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate(cta.action)}
        accessibilityRole="button"
        accessibilityLabel={`${cta.label} — ${displayTitle}`}
        style={styles.item}
      >
        {inner}
      </TouchableOpacity>
    )
  }

  return <View style={styles.item}>{inner}</View>
}

const styles = StyleSheet.create({
  item:        { paddingHorizontal: 20, paddingVertical: 14 },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconCircle:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  body:        { flex: 1, gap: 4 },
  titleRow:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title:       { fontSize: 15, fontWeight: '600', color: colors.text?.primary ?? '#111827', flex: 1 },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  time:        { fontSize: 12, fontWeight: '400', color: colors.text?.muted ?? '#9ca3af', fontVariant: ['tabular-nums'] },
  preview:     { fontSize: 13, fontWeight: '400', color: colors.text?.secondary ?? '#4b5563', lineHeight: 19 },
  expandBtn:   { fontSize: 12, fontWeight: '500', color: colors.text?.muted ?? '#6b7280', marginTop: 2 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  takenLabel:  { fontSize: 12, fontWeight: '500', color: colors.text?.muted ?? '#6b7280' },
  actionLabel: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText:  { fontSize: 13, fontWeight: '600', color: colors.primary?.[600] ?? '#006a5e' },
})
