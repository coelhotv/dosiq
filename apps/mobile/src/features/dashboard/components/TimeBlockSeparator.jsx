import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

/**
 * TimeBlockSeparator - Divisor de turnos para a Timeline (Epic 2)
 * @param {Object} props
 * @param {'Manhã'|'Tarde'|'Noite'|'Madrugada'} type - Turno do dia
 */
export default function TimeBlockSeparator({ type = 'Manhã' }) {
  const getIcon = (t) => {
    switch (t) {
      case 'Madrugada': return '🌙'
      case 'Manhã': return '☀️'
      case 'Tarde': return '🌤️'
      case 'Noite': return '🌙'
      default: return '📅'
    }
  }

  return (
    <View style={styles.container}>
      {/* Linha vertical superior (opcional, depende da posição na lista) */}
      <View style={styles.timelineRow}>
        <View style={styles.dotContainer}>
          <Text style={styles.icon}>{getIcon(type)}</Text>
        </View>
        <Text style={styles.text}>{type}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1c1e',
    fontFamily: 'System',
  }
})
