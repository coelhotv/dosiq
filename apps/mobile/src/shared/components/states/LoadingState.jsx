// LoadingState.jsx — estado de carregamento genérico para telas mobile
// Usado em todas as telas principais enquanto dados carregam pela primeira vez

import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { colors } from '../../styles/tokens'

export default function LoadingState({ message = 'Carregando...' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
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
    gap: 12,
  },
  text: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
})
