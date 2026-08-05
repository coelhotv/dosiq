import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@shared/styles/tokens'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { PackageSearch, AlertTriangle } = LucideIcons as any

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
          <AlertTriangle size={20} color={colors.status.error} />
        ) : (
          <PackageSearch size={20} color={colors.status.warning} />
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
    backgroundColor: colors.status.warningLight,
    borderColor: colors.status.warning,
  },
  critical: {
    backgroundColor: colors.status.errorLight,
    borderColor: colors.status.error,
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
    color: colors.status.warning,
  },
  titleCritical: {
    color: colors.status.error,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
})
