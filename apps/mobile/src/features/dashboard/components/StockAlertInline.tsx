import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { PackageSearch, AlertTriangle } from 'lucide-react-native'

/**
 * StockAlertInline - Banner compacto de alerta de estoque
 * @param {Object} props
 * @param {Array} props.alerts - Lista de alertas de estoque
 */
export default function StockAlertInline({ alerts = [] }) {
  if (!alerts || alerts.length === 0) return null

  // Pegamos o alerta mais crítico (menor quantidade restante)
  const criticalItem = alerts.sort((a, b) => a.daysRemaining - b.daysRemaining)[0]
  const isCritical = criticalItem.daysRemaining <= 2

  return (
    <View style={[
      styles.container, 
      isCritical ? styles.critical : styles.warning
    ]}>
      <View style={styles.iconContainer}>
        {isCritical ? (
          <AlertTriangle size={20} color="#ba1a1a" />
        ) : (
          <PackageSearch size={20} color="#904d00" />
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, isCritical ? styles.titleCritical : styles.titleWarning]}>
          Estoque Baixo: {criticalItem.medicineName}
        </Text>
        <Text style={styles.description}>
          Resta apenas para {criticalItem.daysRemaining} {criticalItem.daysRemaining === 1 ? 'dia' : 'dias'}.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  warning: {
    backgroundColor: '#ffdec1', // Warning container
    borderColor: '#904d00',
  },
  critical: {
    backgroundColor: '#ffdad6', // Error container
    borderColor: '#ba1a1a',
  },
  iconContainer: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  titleWarning: {
    color: '#904d00',
  },
  titleCritical: {
    color: '#ba1a1a',
  },
  description: {
    fontSize: 13,
    color: '#44474e',
    marginTop: 2,
  },
})
