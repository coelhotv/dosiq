import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import SectionCard from '../../../shared/components/ui/SectionCard'
import StockLevelBadge from './StockLevelBadge'
import { colors, spacing } from '../../../shared/styles/tokens'

/**
 * Item de lista para exibição de estoque.
 */
export default function StockItem({ medicine }) {
  const { 
    name, 
    laboratory, 
    totalQuantity, 
    dosage_unit, 
    dosage_per_pill,
    status, 
    daysRemaining,
    hasActiveProtocol
  } = medicine

  return (
    <SectionCard 
      title={
        <View style={styles.titleWrapper}>
          <Text style={styles.titleText}>{name}</Text>
          {dosage_per_pill && (
            <View style={styles.dosagePill}>
              <Text style={styles.dosagePillText}>
                {dosage_per_pill}{dosage_unit}
              </Text>
            </View>
          )}
        </View>
      }
    >
      <View style={styles.container}>
        <View style={styles.infoRow}>
          <View style={styles.mainInfo}>
            {laboratory ? (
              <Text style={styles.lab}>{laboratory}</Text>
            ) : null}
            <Text style={styles.quantity}>
              Saldo: <Text style={styles.bold}>{totalQuantity} unidades</Text>
            </Text>
          </View>
          
          {hasActiveProtocol && (
            <StockLevelBadge 
              status={status} 
              daysRemaining={daysRemaining} 
            />
          )}
        </View>

        {hasActiveProtocol && daysRemaining !== Infinity && (
          <Text style={styles.helperText}>
            Estimativa baseada nos seus protocolos ativos.
          </Text>
        )}
      </View>
    </SectionCard>
  )
}

const styles = StyleSheet.create({
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dosagePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosagePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  container: {
    paddingTop: 4
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  mainInfo: {
    flex: 1,
    marginRight: 10
  },
  lab: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4
  },
  quantity: {
    fontSize: 14,
    color: colors.text.primary
  },
  bold: {
    fontWeight: '700',
    color: colors.text.primary
  },
  helperText: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 12,
    fontStyle: 'italic'
  }
})
