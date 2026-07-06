import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@shared/styles/tokens'

const COLORS = {
  teal: colors.brand.primary,
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  card: colors.bg.card,
}

export default function DoseHistoryKpis({ kpis = { adherence30d: 0, streak: 0, dosesThisMonth: 0 } }) {
  const { adherence30d = 0, streak = 0, dosesThisMonth = 0 } = kpis

  const cards = [
    { value: `${adherence30d}%`, label: 'ADESÃO · 30D' },
    { value: `${streak}`, label: 'SEQUÊNCIA' },
    { value: `${dosesThisMonth}`, label: 'DOSES · MÊS' },
  ]

  return (
    <View style={styles.container}>
      {cards.map((card, index) => (
        <View key={index} style={styles.card}>
          <Text style={styles.value}>{card.value}</Text>
          <Text style={styles.label}>{card.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.teal,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
})
