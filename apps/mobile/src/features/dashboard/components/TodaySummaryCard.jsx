// TodaySummaryCard.jsx — card de resumo do dia na tela Hoje
// Mostra: total de doses esperadas, tomadas, e percentagem de adesão do dia

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import AdherenceRing from './AdherenceRing'

/**
 * @param {{
 *   totalExpected: number,
 *   totalTaken: number,
 *   score: number
 * }} props
 */
export default function TodaySummaryCard({ totalExpected, totalTaken, score }) {
  const remaining = Math.max(0, totalExpected - totalTaken)

  return (
    <View style={styles.card}>
      <View style={styles.mainRow}>
        <AdherenceRing score={score} size={100} strokeWidth={10} />
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalTaken}</Text>
            <Text style={styles.statLabel}>Doses tomadas</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{remaining}</Text>
            <Text style={styles.statLabel}>Doses restantes</Text>
          </View>
        </View>
      </View>
      
      {totalExpected > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {score >= 100 ? 'Dia finalizado com sucesso! 🎉' : 'Mantenha o foco no tratamento hoje.'}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    // Ambient Shadow (R-166)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  statsContainer: {
    flex: 1,
    gap: 12,
  },
  statItem: {
    flexDirection: 'column',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1c1e', // On Surface
  },
  statLabel: {
    fontSize: 13,
    color: '#44474e', // Variant
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f1f1',
  },
  footerText: {
    fontSize: 13,
    color: '#44474e',
    textAlign: 'center',
    fontStyle: 'italic',
  },
})
