import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Check, Clock, XCircle } from 'lucide-react-native'
import { colors, typography, shadows } from '@shared/styles/tokens'

/**
 * DoseTimelineCard - Item de dose para a Timeline (Epic 2)
 * @param {Object} props
 * @param {Object} props.dose - Objeto de dose com timelineStatus
 * @param {Function} props.onRegister - Handler para registrar dose
 */
export default function DoseTimelineCard({ dose, onRegister }) {
  const { timelineStatus, scheduledTime, medicine, protocol } = dose
  const isTaken = timelineStatus === 'TOMADA'
  const isMissed = timelineStatus === 'PERDIDA'
  const isAtrasada = timelineStatus === 'ATRASADA'
  const isProxima = timelineStatus === 'PROXIMA'

  // Muted style para tomadas ou perdidas
  const isMuted = isTaken || isMissed

  const getStatusIcon = () => {
    if (isTaken) return <Check size={18} color={colors.status.success} />
    if (isMissed) return <XCircle size={18} color={colors.status.error} />
    return <Clock size={18} color={colors.neutral[300]} />
  }

  return (
    <View style={[styles.card, isMuted && styles.cardMuted]}>
      <View style={styles.timeLineContainer}>
        <Text style={[styles.timeText, isMuted && styles.mutedText]}>{scheduledTime}</Text>
      </View>

      <View style={styles.info}>
        <Text 
          style={[styles.name, isTaken && styles.strikethrough, isMuted && styles.mutedText]}
          numberOfLines={1}
        >
          {medicine?.name || protocol?.name || 'Medicamento'}
        </Text>
        <Text style={[styles.dosage, isMuted && styles.mutedText]}>
          {protocol?.dosage_per_intake || 1} un. 
          {medicine?.dosage_per_pill ? ` de ${medicine.dosage_per_pill}${medicine.dosage_unit || 'mg'}` : ''}
        </Text>
      </View>

      <View style={styles.statusAction}>
        {(isAtrasada || isProxima) ? (
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => onRegister && onRegister(protocol, scheduledTime)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Tomar</Text>
          </TouchableOpacity>
        ) : (
          getStatusIcon()
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    // Sombra sutil
    ...shadows.xs,
  },
  cardMuted: {
    backgroundColor: colors.border.light,
    opacity: 0.6,
  },
  timeLineContainer: {
    width: 60,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  info: {
    flex: 1,
    paddingLeft: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  dosage: {
    fontSize: 13,
    color: colors.text.secondary,
    fontFamily: typography.fontFamily.regular || 'System',
  },
  mutedText: {
    color: colors.text.muted,
  },
  statusAction: {
    width: 70, // Maior para caber o botão
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionButtonText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold || 'System',
  },
})
