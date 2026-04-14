// EmptyState.jsx — estado vazio genérico para telas mobile
// Exibido quando a query retorna dados mas a lista está vazia

import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../styles/tokens'

export default function EmptyState({ message = 'Nenhum dado encontrado', icon = '📭' }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  icon: {
    fontSize: 40,
    marginBottom: 4,
  },
  text: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
