import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import SectionCard from '../../../shared/components/ui/SectionCard'
import StockLevelBadge from './StockLevelBadge'
import { formatStockQuantity, formatConcentration } from '@dosiq/core'
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

  // Líquido → "X ml"; sólido → hint princípio ativo / "X un." (formatStockQuantity)
  const saldoText = formatStockQuantity(totalQuantity, { dosage_unit, dosage_per_pill })

  return (
    <SectionCard 
      title={
        <View style={styles.titleWrapper}>
          <Text style={styles.titleText}>{name}</Text>
          {dosage_per_pill && (
            <View style={styles.dosagePill}>
              <Text style={styles.dosagePillText}>
                {formatConcentration(dosage_per_pill, dosage_unit)}
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
              Saldo: <Text style={styles.bold}>{saldoText}</Text>
            </Text>
          </View>
          
          {hasActiveProtocol && (
            <StockLevelBadge
              status={status}
              daysRemaining={daysRemaining}
            />
          )}
        </View>
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
  }
})
