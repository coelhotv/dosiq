import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { BellRing, Check } from 'lucide-react-native'

/**
 * PriorityActionCard - Card de alta urgência para doses na janela de agora (Now/Late)
 * @param {Object} props
 * @param {Object} props.dose - Objeto da dose vindo do calculateDosesByDate
 * @param {Function} props.onPress - Handler para marcar como tomada
 */
export default function PriorityActionCard({ dose, onPress }) {
  if (!dose) return null

  const medicineName = dose.medicine?.name || 'Medicamento'
  const scheduledTime = dose.scheduledTime || '--:--'
  
  // No mobile, usamos cores vibrantes sem gradiente para manter compatibilidade zero-deps
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <BellRing size={20} color="#fff" style={styles.icon} />
          <Text style={styles.alertText}>URGENTE AGORA</Text> 
        </View>
        
        <Text style={styles.medicineName}>{medicineName}</Text>
        <Text style={styles.timeInfo}>Horário agendado: {scheduledTime}</Text>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onPress && onPress(dose)}
          activeOpacity={0.8}
        >
          <Check size={20} color="#005db6" />
          <Text style={styles.buttonText}>Confirmar Ingestão</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: '#005db6', // Sanctuary Deep Blue
    padding: 24,
    // Sanctuary Ambient Shadow (lg)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  alertText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#99f6e4', // Emerald Light para contraste
    letterSpacing: 1.5,
  },
  medicineName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  timeInfo: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 24,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#005db6',
    marginLeft: 10,
  },
})
