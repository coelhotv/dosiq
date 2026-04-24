/**
 * NotificationItem — Item de lista da Central de Avisos (Mobile).
 *
 * Padrão Santuário: espaçamento generoso, ícone circular, tipografia forte.
 * R-167: logs em __DEV__ apenas. R-138: ícone sempre com label. ADR-023: fontWeight ≥ 400.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import {
  Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell, ChevronRight,
} from 'lucide-react-native'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import { colors } from '../../../shared/styles/tokens'

const ICON_MAP = { Clock, Package, AlertTriangle, BarChart2, TrendingUp, Bell }

const DEEP_LINK_LABELS = {
  dashboard: 'Ver doses',
  stock:     'Ver estoque',
  history:   'Ver histórico',
  treatment: 'Ver tratamento',
}

/**
 * @param {Object} props
 * @param {Object} props.notification
 * @param {function(string):void} [props.onNavigate]
 */
export default function NotificationItem({ notification, onNavigate }) {
  const { notification_type, status, sent_at, provider_metadata = {} } = notification

  const { iconName, color, bgColor, label, deepLinkAction } =
    getNotificationIcon(notification_type)

  const IconComponent = ICON_MAP[iconName] ?? Bell
  const relativeTime  = formatRelativeTime(sent_at)
  const preview       = provider_metadata?.message ?? null
  const isFailed      = status === 'falhou' || status === 'failed'
  const hasAction     = deepLinkAction && !!onNavigate

  const content = (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
        <IconComponent size={20} color={color} strokeWidth={2} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          <Text style={styles.time}>{relativeTime}</Text>
        </View>

        {preview ? (
          <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
        ) : null}

        <View style={styles.footer}>
          <View style={[styles.statusBadge, isFailed ? styles.statusFailed : styles.statusSent]}>
            <Text style={[styles.statusText, isFailed ? styles.statusTextFailed : styles.statusTextSent]}>
              {isFailed ? 'Falhou' : 'Enviada'}
            </Text>
          </View>

          {hasAction && (
            <View style={styles.actionLabel}>
              <Text style={styles.actionText}>{DEEP_LINK_LABELS[deepLinkAction]}</Text>
              <ChevronRight size={13} color={colors.primary?.[600] ?? '#006a5e'} strokeWidth={2.5} />
            </View>
          )}
        </View>
      </View>
    </View>
  )

  if (hasAction) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate(deepLinkAction)}
        accessibilityRole="button"
        accessibilityLabel={`${label} — ${DEEP_LINK_LABELS[deepLinkAction]}`}
        style={styles.item}
      >
        {content}
      </TouchableOpacity>
    )
  }

  return <View style={styles.item}>{content}</View>
}

const styles = StyleSheet.create({
  item:              { paddingHorizontal: 20, paddingVertical: 14 },
  row:               { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconCircle:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  body:              { flex: 1, gap: 4 },
  titleRow:          { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  label:             { fontSize: 15, fontWeight: '600', color: colors.text?.primary ?? '#111827', flex: 1 },
  time:              { fontSize: 12, fontWeight: '400', color: colors.text?.muted ?? '#9ca3af', flexShrink: 0, fontVariant: ['tabular-nums'] },
  preview:           { fontSize: 13, fontWeight: '400', color: colors.text?.secondary ?? '#4b5563', lineHeight: 19 },
  footer:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statusBadge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  statusSent:        { backgroundColor: 'rgba(22, 163, 74, 0.10)' },
  statusFailed:      { backgroundColor: 'rgba(220, 38, 38, 0.10)' },
  statusText:        { fontSize: 11, fontWeight: '600' },
  statusTextSent:    { color: colors.status?.success ?? '#16a34a' },
  statusTextFailed:  { color: colors.status?.error ?? '#dc2626' },
  actionLabel:       { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText:        { fontSize: 13, fontWeight: '600', color: colors.primary?.[600] ?? '#006a5e' },
})
