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
    backgroundColor: '#005db6', // Primary (Primary Fixed style)
    padding: 20,
    // Ambient Shadow (R-166)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 6,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.2,
  },
  medicineName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  timeInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#005db6',
    marginLeft: 8,
  },
})
