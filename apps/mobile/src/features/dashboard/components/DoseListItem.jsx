import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Check, Clock, AlertCircle } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'
import { getNow, parseLocalDate, formatLocalDate, parseISO, getTodayLocal } from '@dosiq/core'

// Config de status por estado da dose (LOOKUP_TABLE)
const _STATUS_CONFIG = {
  taken:    { cardStyle: 'cardTaken',   iconBg: 'bgTaken',     Icon: Check,        iconColor: () => colors.bg.card },
  missed:   { cardStyle: 'cardMissed',  iconBg: 'bgMissed',    Icon: AlertCircle,  iconColor: () => colors.bg.card },
  pending:  { cardStyle: null,           iconBg: 'bgScheduled', Icon: Clock,        iconColor: () => colors.brand.primary },
}

function _getDoseStatus(isTaken, isMissed) {
  if (isTaken) return 'taken'
  if (isMissed) return 'missed'
  return 'pending'
}

function _formatTakenTime(takenAt) {
  const formatted = formatLocalDate(parseISO(takenAt), true)
  return formatted.split(' ')[1].substring(0, 5) // HH:mm
}

function _isWithinTwoHours(scheduledTime) {
  const [h, m] = scheduledTime.split(':').map(Number)
  const todayStr = getTodayLocal()
  const scheduledDate = parseLocalDate(todayStr)
  scheduledDate.setHours(h, m, 0, 0)
  const now = getNow()
  const diffHours = Math.abs(now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60)
  return diffHours <= 2
}

/**
 * DoseListItem - Item de dose individual (Splitted)
 * @param {{
 *   dose: Object,
 *   onRegister: Function
 * }} props
 */
function _buildDosageLabel(protocol, medicine) {
  const qty = protocol?.dosage_per_intake || 1
  const perPill = medicine?.dosage_per_pill
  const unit = medicine?.dosage_unit || 'mg'
  return perPill ? `${qty} un. de ${perPill}${unit}` : `${qty} un.`
}

function _buildDisplayName(medicine, protocol) {
  return medicine?.name ?? protocol?.name ?? 'Medicamento'
}

export default function DoseListItem({ dose, onRegister }) {
  const medicine = dose.medicine
  const protocol = dose.protocol
  const scheduledTime = dose.scheduledTime
  const takenAt = dose.taken_at || dose.registeredAt

  const isTaken = dose.status === 'done' || !!takenAt
  const isMissed = dose.status === 'missed'
  const statusKey = _getDoseStatus(isTaken, isMissed)
  const { cardStyle, iconBg, Icon, iconColor } = _STATUS_CONFIG[statusKey]

  const displayTime = isTaken && takenAt ? _formatTakenTime(takenAt) : (scheduledTime || '--:--')
  const displayName = _buildDisplayName(medicine, protocol)
  const dosageLabel = _buildDosageLabel(protocol, medicine)

  // Verificação de janela para o botão Tomar (+/- 2h)
  const isWithinWindow = React.useMemo(() => {
    if (!scheduledTime || isTaken) return false
    return _isWithinTwoHours(scheduledTime)
  }, [scheduledTime, isTaken])

  const showCta = !isTaken && (isWithinWindow || isMissed)

  return (
    <View style={[styles.card, cardStyle && styles[cardStyle]]}>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, isTaken && styles.textMuted]}>{displayTime}</Text>
        <View style={[styles.statusIcon, styles[iconBg]]}>
          <Icon size={14} color={iconColor()} />
        </View>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isTaken && styles.textMuted]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.dosage, isTaken && styles.textMuted]}>
          {dosageLabel}
        </Text>
      </View>

      {showCta && (
        <TouchableOpacity
          style={[styles.ctaButton, isMissed && styles.ctaMissed]}
          onPress={() => onRegister(protocol, scheduledTime)}
          activeOpacity={0.7}
        >
          <Text style={styles.ctaText}>Tomar</Text>
        </TouchableOpacity>
      )}

      {isTaken && (
        <View style={styles.doneBadge}>
          <Check size={18} color={colors.status.success} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    // Ambient Shadow
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: spacing[4],
  },
  cardTaken: {
    backgroundColor: colors.neutral[50], 
    elevation: 0,
    shadowOpacity: 0,
  },
  cardMissed: {
    borderLeftWidth: 4,
    borderLeftColor: colors.status.error,
  },
  timeContainer: {
    alignItems: 'center',
    width: 50,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  statusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgTaken: { backgroundColor: colors.status.success },
  bgMissed: { backgroundColor: colors.status.error },
  bgScheduled: { backgroundColor: colors.neutral[100] }, 
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dosage: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  textMuted: {
    color: colors.text.muted,
  },
  ctaButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  ctaMissed: {
    backgroundColor: colors.status.error,
  },
  ctaText: {
    color: colors.bg.card,
    fontSize: 13,
    fontWeight: '700',
  },
  doneBadge: {
    width: 40,
    alignItems: 'center',
  },
})
