import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import SectionCard from '../../../shared/components/ui/SectionCard'
import StockLevelBadge from './StockLevelBadge'

/**
 * Item de lista para exibição de estoque.
 */
export default function StockItem({ medicine }) {
  const { 
    name, 
    laboratory, 
    totalQuantity, 
    dosage_unit, 
    status, 
    daysRemaining 
  } = medicine

  return (
    <SectionCard title={name}>
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
          
          <StockLevelBadge 
            status={status} 
            daysRemaining={daysRemaining} 
          />
        </View>

        {daysRemaining !== Infinity && (
          <Text style={styles.helperText}>
            Estimativa baseada nos seus protocolos ativos.
          </Text>
        )}
      </View>
    </SectionCard>
  )
}

const styles = StyleSheet.create({
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
    color: '#666',
    marginBottom: 4
  },
  quantity: {
    fontSize: 14,
    color: '#333'
  },
  bold: {
    fontWeight: '700'
  },
  helperText: {
    fontSize: 11,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic'
  }
})
