// EmptyState.jsx — estado vazio genérico para telas mobile
// Exibido quando a query retorna dados mas a lista está vazia

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors } from '../../styles/tokens'

// `action` opcional: { label, onPress } → renderiza um botão primário (CTA).
export default function EmptyState({ title, message = 'Nenhum dado encontrado', icon = '📭', action = null }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.text}>{message}</Text>
      {action ? (
        <Pressable style={styles.actionBtn} onPress={action.onPress} accessibilityRole="button">
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
  },
  actionBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.brand.primary,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.inverse,
    textAlign: 'center',
  },
})
