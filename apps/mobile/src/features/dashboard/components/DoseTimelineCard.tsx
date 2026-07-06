import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Check, Clock, XCircle } = LucideIcons as any
import { colors, typography, shadows } from '@shared/styles/tokens'
import { formatIntakeDose, daysAgoLabel, getRawNow, DEFAULT_TZ } from '@dosiq/core'

/** Ícone de status da dose (helper de módulo — não conta p/ complexidade do componente). */
function StatusIcon({ timelineStatus }) {
  if (timelineStatus === 'TOMADA') return <Check size={18} color={colors.status.success} />
  if (timelineStatus === 'PERDIDA') return <XCircle size={18} color={colors.status.error} />
  return <Clock size={18} color={colors.neutral[300]} />
}

/**
 * 012 Fase B (FR-008b): monta o texto do horário para doses carry-over.
 * Para doses não registradas, prefixo relativo: "ontem · 10:00" | "há 2 dias · 10:00".
 * Registradas/perdidas retornam apenas o horário simples.
 * @returns {{ displayTime: string, hasLabel: boolean }}
 */
function resolveDisplayTime(scheduledTime, scheduledFor, isCarryOver, isTaken) {
  if (!isCarryOver || isTaken || !scheduledFor) return { displayTime: scheduledTime, hasLabel: false }
  const label = daysAgoLabel(scheduledFor, getRawNow(), DEFAULT_TZ)
  if (!label) return { displayTime: scheduledTime, hasLabel: false }
  return { displayTime: `${label} · ${scheduledTime}`, hasLabel: true }
}

/**
 * DoseTimelineCard - Item de dose para a Timeline (Epic 2)
 * @param {Object} props
 * @param {Object} props.dose - Objeto de dose com timelineStatus
 * @param {Function} props.onRegister - Handler para registrar dose
 * @param {boolean} [props.isCarryOver] - 012 Fase B (FR-008b): quando true, prefixar
 *   o horário com rótulo relativo p/ doses pendentes de dias anteriores (tolerância GLP-1 5040min).
 */
export default function DoseTimelineCard({ dose, onRegister, isCarryOver = false }) {
  const { timelineStatus, scheduledTime, scheduledFor, medicine, protocol } = dose
  const isTaken = timelineStatus === 'TOMADA'
  const isMissed = timelineStatus === 'PERDIDA'
  const isAtrasada = timelineStatus === 'ATRASADA'
  const isProxima = timelineStatus === 'PROXIMA'

  // Muted style para tomadas ou perdidas
  const isMuted = isTaken || isMissed

  const { displayTime, hasLabel } = resolveDisplayTime(scheduledTime, scheduledFor, isCarryOver, isTaken)

  return (
    <View style={[styles.card, isMuted && styles.cardMuted]}>
      <View style={[styles.timeLineContainer, hasLabel && styles.timeLineContainerWide]}>
        <Text style={[styles.timeText, isMuted && styles.mutedText, hasLabel && styles.timeTextSmall]}>{displayTime}</Text>
      </View>

      <View style={styles.info}>
        <Text 
          style={[styles.name, isTaken && styles.strikethrough, isMuted && styles.mutedText]}
          numberOfLines={1}
        >
          {medicine?.name || protocol?.name || 'Medicamento'}
        </Text>
        <Text style={[styles.dosage, isMuted && styles.mutedText]}>
          {formatIntakeDose(protocol?.dosage_per_intake ?? 1, protocol?.intake_unit, medicine)}
        </Text>
      </View>

      <View style={styles.statusAction}>
        {(isAtrasada || isProxima) ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onRegister && onRegister(protocol, scheduledTime, dose.instanceId)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>Tomar</Text>
          </TouchableOpacity>
        ) : (
          <StatusIcon timelineStatus={timelineStatus} />
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
  // 012 Fase B (FR-008b): container mais largo quando exibe rótulo relativo ("ontem · 10:00")
  timeLineContainerWide: {
    width: 110,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold || 'System',
  },
  // 012 Fase B (FR-008b): fonte levemente menor p/ caber o rótulo relativo sem quebra
  timeTextSmall: {
    fontSize: 13,
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
