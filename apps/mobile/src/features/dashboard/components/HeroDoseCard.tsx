import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { BellRing, Check, AlertCircle } = LucideIcons as any
import { getNow, parseISO, getUserTime } from '@dosiq/core'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * HeroDoseCard - Card de destaque para a dose atual ou atrasada (Epic 2)
 * @param {Object} props
 * @param {Array} props.doses - Conjunto de doses prioritárias
 * @param {Function} props.onPress - Ação de confirmar uso
 */
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

export default function HeroDoseCard({ doses = [], onPress }) {
  if (!doses || doses.length === 0) return null

  const firstDose = doses[0]
  const isMultiple = doses.length > 1
  const isDelayed = ['atrasada', 'delayed'].includes(firstDose.timelineStatus?.toLowerCase())

  const nextTime = firstDose.scheduledTime || ''
  const scheduledFor = firstDose.scheduledFor
  const now = getNow()
  const [hour, minute] = nextTime.split(':').map(Number)
  const scheduled = getNow()
  if (!isNaN(hour) && !isNaN(minute)) {
    scheduled.setHours(hour, minute, 0, 0)
  }
  const diffMin = Math.round((scheduled.getTime() - now.getTime()) / 60000)

  const TZ = 'America/Sao_Paulo'
  const scheduledLocal = scheduledFor ? getUserTime(parseISO(scheduledFor), TZ) : null
  const isCarryOver =
    !!scheduledLocal &&
    (scheduledLocal.getFullYear() !== now.getFullYear() ||
      scheduledLocal.getMonth() !== now.getMonth() ||
      scheduledLocal.getDate() !== now.getDate())

  const timeLabel = (() => {
    if (isCarryOver && scheduledLocal) {
      const weekday = WEEKDAYS[scheduledLocal.getDay()]
      return `${weekday} às ${nextTime}`
    }
    if (diffMin <= 0) return 'Agora'
    if (diffMin < 60) return `Em ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`
    return `Às ${nextTime}`
  })()

  const medicineName = firstDose.medicine?.name || 'Medicamento'
  const displayTitle = isDelayed ? 'AINDA DÁ TEMPO' : 'TOMAR AGORA'
  const alertColor = isDelayed ? '#904d00' : colors.brand.light
  const buttonBgColor = isDelayed ? '#f9a825' : colors.bg.card
  const buttonTextColor = isDelayed ? colors.neutral[800] : colors.brand.primary
  const textColor = isDelayed ? colors.neutral[800] : colors.text.inverse
  const timeColor = isDelayed ? colors.neutral[600] : 'rgba(255, 255, 255, 0.7)'

  return (
    <View style={[styles.container, isDelayed && styles.containerDelayed]}>
      <View style={styles.content}>
        <View style={styles.header}>
          {isDelayed ? (
            <AlertCircle size={20} color={alertColor} style={styles.icon} />
          ) : (
            <BellRing size={20} color={alertColor} style={styles.icon} />
          )}
          <Text style={[styles.alertText, { color: alertColor }]}>
            {isMultiple ? `${doses.length} PENDÊNCIAS` : displayTitle}
          </Text> 
        </View>
        
        <Text style={[styles.medicineName, { color: textColor }]} numberOfLines={2}>
          {isMultiple ? `${medicineName} e mais ${doses.length - 1}` : medicineName}
        </Text>
        <Text style={[styles.timeInfo, { color: timeColor }]}>
          {timeLabel}
        </Text>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: buttonBgColor }]} 
          onPress={() => onPress && onPress(firstDose)}
          activeOpacity={0.8}
        >
          <Check size={20} color={buttonTextColor} />
          <Text style={[styles.buttonText, { color: buttonTextColor }]}>
            Confirmar agora
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.brand.primary,
    padding: spacing[6],
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.doseDelayed.borderNone,
  },
  containerDelayed: {
    backgroundColor: colors.doseDelayed.bg,
    borderColor: colors.doseDelayed.border,
    elevation: 2,
  },
  content: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  icon: {
    marginRight: spacing[2],
  },
  alertText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  medicineName: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: spacing[1],
  },
  timeInfo: {
    fontSize: 15,
    marginBottom: spacing[6],
  },
  actionButton: {
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    marginLeft: spacing[2],
  },
})
