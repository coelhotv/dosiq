/**
 * NotificationItem — Item da Central de Avisos (Mobile).
 *
 * Título contextual por tipo (medicine_name / protocol_name).
 * CTA semântico por tipo via NotificationActions.
 * R-167: logs em __DEV__ apenas. R-138: ícone sempre com label. ADR-023: fontWeight ≥ 400.
 */
import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import { 
  AlertTriangle, Bell, Clock, Package, BarChart2, TrendingUp, 
  ListChecks, Tablets, PieChart, BarChart3, NotepadText 
} from 'lucide-react-native'
import { getNotificationIcon, formatRelativeTime } from '@dosiq/core'
import { parseTelegramMarkdownNative } from '../utils/markdownParser'
import { colors } from '../../../shared/styles/tokens'
import NotificationActions from './NotificationActions'

const ICON_COMPONENTS = {
  Pill: Clock,
  Package,
  AlertTriangle,
  NotepadText,
  TrendingUp,
  ListChecks,
  Tablets,
  PieChart,
  BarChart3,
  Bell
}

// Renderiza o corpo da notificação (doses ou body text)
function NotificationItemBody({ doses, displayBody, isDailyDigest, expanded, onToggleExpanded }) {
  if (doses?.length > 0) {
    return (
      <View style={styles.doseList}>
        {doses.map((dose, i) => (
          <Text key={i} style={styles.doseItem}>
            {`${dose.dosage}x ${dose.medicineName}`}
          </Text>
        ))}
      </View>
    )
  }
  if (!displayBody) return null
  return (
    <>
      <Text
        style={styles.preview}
        numberOfLines={isDailyDigest && !expanded ? 2 : undefined}
      >
        {parseTelegramMarkdownNative(displayBody)}
      </Text>
      {isDailyDigest && (
        <Pressable
          onPress={onToggleExpanded}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Ver menos' : 'Ver mais'}
          hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
        >
          <Text style={styles.expandBtn}>{expanded ? 'Ver menos' : 'Ver mais'}</Text>
        </Pressable>
      )}
    </>
  )
}

function resolveTitle(notification, label) {
  const { notification_type, medicine_name, protocol_name, treatment_plan_name } = notification
  switch (notification_type) {
    case 'dose_reminder':
    case 'stock_alert':
    case 'missed_dose':
      return medicine_name ?? label
    case 'titration_update':
      return protocol_name ?? label
    case 'daily_digest':
      return 'Resumo do dia'
    case 'dose_reminder_by_plan':
      return treatment_plan_name ?? 'Plano de tratamento'
    case 'dose_reminder_misc':
      return 'Doses agora'
    default:
      return label
  }
}

/**
 * @param {Object} props
 * @param {Object}   props.notification - Objeto notificationLog do DB
 * @param {boolean|Object} [props.wasTaken] - Se dose já foi registrada ou objeto de progresso
 * @param {function} [props.onNavigate] - (routeName) => void
 */
export default function NotificationItem({ notification, wasTaken, onNavigate }) {
  const [expanded, setExpanded] = useState(false)

  const { notification_type, status, sent_at, body } = notification

  const { iconName, color, bgColor, label } = getNotificationIcon(notification_type)
  const relativeTime   = formatRelativeTime(sent_at)
  const isFailed       = ['falhou', 'failed'].includes(status?.toLowerCase())
  const isDailyDigest  = notification_type === 'daily_digest'
  const isDoseReminder = ['dose_reminder', 'dose_reminder_by_plan', 'dose_reminder_misc'].includes(notification_type)

  const displayTitle = resolveTitle(notification, label)
  const displayBody  = body ?? null
  const doses        = notification.doses ?? null

  const IconComponent = ICON_COMPONENTS[iconName] ?? Bell

  // Verifica se deve ser clicável baseado no CTA_MAP consolidado
  const cta = NotificationActions.getCTA(notification_type)
  const groupedComplete = isDoseReminder && typeof wasTaken === 'object' && wasTaken.taken === wasTaken.total
  const hasNavAction = cta && !!onNavigate && !(isDoseReminder && wasTaken === true) && !groupedComplete

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
                color={colors.status?.error}
                strokeWidth={2.5}
                accessibilityLabel="Falhou ao enviar"
              />
            )}
          </View>
        </View>

        {/* Corpo */}
        <NotificationItemBody
          doses={doses}
          displayBody={displayBody}
          isDailyDigest={isDailyDigest}
          expanded={expanded}
          onToggleExpanded={() => setExpanded(prev => !prev)}
        />

        {/* Rodapé: Ações Consolidadas */}
        <View style={styles.footer}>
          <NotificationActions 
            notification={notification}
            wasTaken={wasTaken}
            onNavigate={onNavigate}
            isDoseReminder={isDoseReminder}
            groupedComplete={groupedComplete}
          />
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
  title:       { fontSize: 15, fontWeight: '600', color: colors.text?.primary, flex: 1 },
  timeRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  time:        { fontSize: 12, fontWeight: '400', color: colors.text?.muted },
  preview:     { fontSize: 13, fontWeight: '400', color: colors.text?.secondary, lineHeight: 19 },
  expandBtn:   { fontSize: 12, fontWeight: '500', color: colors.text?.muted, marginTop: 2 },
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  doseList:    { gap: 2, marginTop: 2 },
  doseItem:    { fontSize: 13, fontWeight: '400', color: colors.text?.secondary, lineHeight: 19 },
})
