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
    // Sanctuary Ambient Shadow (lg)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  statsContainer: {
    flex: 1,
    gap: 16,
  },
  statItem: {
    flexDirection: 'column',
  },
  statValue: {
    fontSize: 32, // Maior para destaque premium
    fontWeight: '800',
    color: '#1a1c1e', // neutral.800
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#44474e', // neutral.600
    marginTop: -2,
  },
  footer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f4f9', // neutral.100
  },
  footerText: {
    fontSize: 14,
    color: '#44474e',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
  },
})
