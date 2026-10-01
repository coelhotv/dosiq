import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@shared/styles/tokens'

const COLORS = {
  teal: colors.brand.primary,
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  card: colors.bg.card,
}

/**
 * `pending` = primeira carga ainda sem dados: mostra "—" em vez de 0. Um "0%" de adesão enquanto
 * a timeline carrega afirma um fato falso (e alarmante) para quem tem adesão real.
 */
export default function DoseHistoryKpis({ kpis = { adherence30d: 0, streak: 0, dosesThisMonth: 0 }, pending = false }) {
  const { adherence30d = 0, streak = 0, dosesThisMonth = 0 } = kpis

  const cards = [
    { value: pending ? '—' : `${adherence30d}%`, label: 'ADESÃO · 30D' },
    { value: pending ? '—' : `${streak}`, label: 'SEQUÊNCIA' },
    { value: pending ? '—' : `${dosesThisMonth}`, label: 'DOSES · MÊS' },
  ]

  return (
    <View style={styles.container}>
      {cards.map((card, index) => (
        <View
          key={index}
          style={styles.card}
          accessibilityLabel={pending ? `${card.label}: carregando` : undefined}
        >
          <Text style={[styles.value, pending && styles.valuePending]}>{card.value}</Text>
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
  valuePending: {
    color: COLORS.textSecondary,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
})
