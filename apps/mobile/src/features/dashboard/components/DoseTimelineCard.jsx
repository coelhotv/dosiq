import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Check, Clock, XCircle } from 'lucide-react-native'

/**
 * DoseTimelineCard - Item de dose para a Timeline (Epic 2)
 * @param {Object} props
 * @param {Object} props.dose - Objeto de dose com timelineStatus
 */
export default function DoseTimelineCard({ dose }) {
  const { timelineStatus, scheduledTime, medicine, protocol } = dose
  const isTaken = timelineStatus === 'TOMADA'
  const isMissed = timelineStatus === 'PERDIDA'
  const isAtrasada = timelineStatus === 'ATRASADA'
  const isProxima = timelineStatus === 'PROXIMA'
  const isPlanejada = timelineStatus === 'PLANEJADA'

  // Muted style para tomadas ou perdidas
  const isMuted = isTaken || isMissed

  const getStatusIcon = () => {
    if (isTaken) return <Check size={18} color="#006a5e" />
    if (isMissed) return <XCircle size={18} color="#ba1a1a" />
    return <View style={styles.radioOutline} />
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
        {getStatusIcon()}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    // Sombra sutil
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardMuted: {
    backgroundColor: '#f1f1f1',
    opacity: 0.6,
  },
  timeLineContainer: {
    width: 60,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1c1e',
  },
  info: {
    flex: 1,
    paddingLeft: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1c1e',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  dosage: {
    fontSize: 13,
    color: '#44474e',
  },
  mutedText: {
    color: '#74777f',
  },
  statusAction: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOutline: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#c4c6cf',
  }
})
