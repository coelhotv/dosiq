import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { BellRing, Check } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * PriorityActionCard - Card de alta urgência para doses na janela de agora (Now/Late)
 * @param {Object} props
 * @param {Array} props.doses - Lista de doses prioritárias (até 3)
 * @param {Function} props.onPress - Handler para marcar como tomada (abre a primeira)
 */
export default function PriorityActionCard({ doses, onPress }) {
  if (!doses || doses.length === 0) return null

  const isMultiple = doses.length > 1
  const firstDose = doses[0]
  const medicineName = firstDose.medicine?.name || 'Medicamento'
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <BellRing size={20} color={colors.primary[100]} style={styles.icon} />
          <Text style={styles.alertText}>
            {isMultiple ? `${doses.length} MEDICAMENTOS AGORA` : 'URGENTE AGORA'}
          </Text> 
        </View>
        
        <Text style={styles.medicineName} numberOfLines={2}>
          {isMultiple ? `${medicineName} e outros...` : medicineName}
        </Text>
        <Text style={styles.timeInfo}>
          {isMultiple 
            ? `Próxima: ${firstDose.scheduledTime || '--:--'}`
            : `Horário agendado: ${firstDose.scheduledTime || '--:--'}`
          }
        </Text>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onPress && onPress(firstDose)}
          activeOpacity={0.8}
        >
          <Check size={20} color={colors.primary[600]} />
          <Text style={styles.buttonText}>
            {isMultiple ? 'Ver Urgências' : 'Confirmar Ingestão'}
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
    backgroundColor: colors.primary[600],
    padding: spacing[6],
    // Sanctuary Ambient Shadow (lg)
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
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
    color: colors.primary[200], 
    letterSpacing: 1.5,
  },
  medicineName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.bg.card, // White text
    marginBottom: spacing[1],
  },
  timeInfo: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing[6],
  },
  actionButton: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[4],
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary[600],
    marginLeft: spacing[2],
  },
})
