import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { BellRing, Check, AlertCircle } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '../../../shared/styles/tokens'

/**
 * HeroDoseCard - Card de destaque para a dose atual ou atrasada (Epic 2)
 * @param {Object} props
 * @param {Array} props.doses - Conjunto de doses prioritárias
 * @param {Function} props.onPress - Ação de confirmar uso
 */
export default function HeroDoseCard({ doses = [], onPress }) {
  if (doses.length === 0) return null

  const firstDose = doses[0]
  const isMultiple = doses.length > 1
  const isDelayed = firstDose.timelineStatus === 'ATRASADA'
  
  const medicineName = firstDose.medicine?.name || 'Medicamento'
  const displayTitle = isDelayed ? 'AINDA DÁ TEMPO' : 'TOMAR AGORA'
  const alertColor = isDelayed ? '#ffb4ab' : colors.primary[200] // Red-ish for delay

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
          <Check size={20} color={isDelayed ? '#ba1a1a' : colors.primary[600]} />
          <Text style={[styles.buttonText, { color: isDelayed ? '#ba1a1a' : colors.primary[600] }]}>
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
    backgroundColor: colors.primary[600],
    padding: spacing[6],
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  containerDelayed: {
    backgroundColor: '#ba1a1a', // Alerta crítico
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
    letterSpacing: 1.5,
  },
  medicineName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: spacing[1],
  },
  timeInfo: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: spacing[6],
  },
  actionButton: {
    backgroundColor: '#ffffff',
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
