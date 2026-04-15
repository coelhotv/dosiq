import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Check, Clock, AlertCircle } from 'lucide-react-native'

/**
 * DoseListItem - Item de dose individual (Splitted)
 * @param {{
 *   dose: Object,
 *   onRegister: Function
 * }} props
 */
export default function DoseListItem({ dose, onRegister }) {
  const medicine = dose.medicine
  const protocol = dose.protocol
  const scheduledTime = dose.scheduledTime
  const registeredAt = dose.registeredAt || dose.taken_at
  
  // Se for dose extra ou tomada fora de janela, usamos o horário real do registro para o visor
  const displayTime = scheduledTime || (registeredAt ? new Date(registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--')

  const isTaken = dose.status === 'taken' || !!registeredAt
  const isMissed = dose.status === 'missed'

  return (
    <View style={[
      styles.card, 
      isTaken && styles.cardTaken,
      isMissed && styles.cardMissed
    ]}>
      <View style={styles.timeContainer}>
        <Text style={[styles.timeText, isTaken && styles.textMuted]}>{displayTime}</Text>
        <View style={[styles.statusIcon, isTaken ? styles.bgTaken : isMissed ? styles.bgMissed : styles.bgScheduled]}>
          {isTaken ? (
            <Check size={14} color="#fff" />
          ) : isMissed ? (
            <AlertCircle size={14} color="#fff" />
          ) : (
            <Clock size={14} color="#005db6" />
          )}
        </View>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, isTaken && styles.textMuted]} numberOfLines={1}>
          {medicine?.name ?? 'Medicamento'}
        </Text>
        <Text style={[styles.dosage, isTaken && styles.textMuted]}>
          {protocol?.dosage_per_intake} {protocol?.unit || 'unidade(s)'}
        </Text>
      </View>

      {!isTaken && (
        <TouchableOpacity 
          style={[styles.ctaButton, isMissed && styles.ctaMissed]} 
          onPress={() => !isTaken && onRegister(protocol, scheduledTime)}
          activeOpacity={0.7}
        >
          <Text style={styles.ctaText}>{isMissed ? 'Registrar' : 'Tomar'}</Text>
        </TouchableOpacity>
      )}

      {isTaken && (
        <View style={styles.doneBadge}>
          <Check size={16} color="#4fb3a4" />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    // Ambient Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 16,
  },
  cardTaken: {
    opacity: 0.5,
    backgroundColor: '#f8f9fa',
    elevation: 0,
    shadowOpacity: 0,
  },
  cardMissed: {
    borderLeftWidth: 4,
    borderLeftColor: '#ba1a1a', // Error
  },
  timeContainer: {
    alignItems: 'center',
    width: 50,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1c1e',
    marginBottom: 4,
  },
  statusIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgTaken: { backgroundColor: '#4fb3a4' },
  bgMissed: { backgroundColor: '#ba1a1a' },
  bgScheduled: { backgroundColor: '#e0e2ec' }, // Secondary container
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1c1e',
  },
  dosage: {
    fontSize: 13,
    color: '#44474e',
  },
  textMuted: {
    color: '#8e9199',
  },
  ctaButton: {
    backgroundColor: '#005db6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaMissed: {
    backgroundColor: '#ba1a1a',
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  doneBadge: {
    width: 40,
    alignItems: 'center',
  },
})
