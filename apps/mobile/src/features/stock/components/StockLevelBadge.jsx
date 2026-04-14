import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { AlertCircle, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react-native'

/**
 * Badge visual para nível de estoque conforme ADR-018.
 * 
 * @param {string} status - Tier de estoque (CRITICAL, LOW, NORMAL, HIGH)
 * @param {number} daysRemaining - Dias calculados restantes
 */
export default function StockLevelBadge({ status, daysRemaining }) {
  const getLevelConfig = () => {
    switch (status) {
      case 'CRITICAL':
        return {
          color: '#ef4444',
          bg: '#fee2e2',
          icon: AlertCircle,
          label: 'Crítico'
        }
      case 'LOW':
        return {
          color: '#f59e0b',
          bg: '#fef3c7',
          icon: AlertTriangle,
          label: 'Baixo'
        }
      case 'NORMAL':
        return {
          color: '#22c55e',
          bg: '#dcfce7',
          icon: CheckCircle,
          label: 'Normal'
        }
      case 'HIGH':
      default:
        return {
          color: '#3b82f6',
          bg: '#dbeafe',
          icon: TrendingUp,
          label: 'Bom'
        }
    }
  }

  const { color, bg, icon: Icon, label } = getLevelConfig()
  const daysText = daysRemaining === Infinity 
    ? '-- dias' 
    : `${Math.floor(daysRemaining)} dias`

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Icon size={14} color={color} strokeWidth={2.5} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      <View style={[styles.separator, { backgroundColor: color }]} />
      <Text style={[styles.days, { color }]}>{daysText}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase'
  },
  separator: {
    width: 1,
    height: 10,
    marginHorizontal: 8,
    opacity: 0.3
  },
  days: {
    fontSize: 11,
    fontWeight: '600'
  }
})
