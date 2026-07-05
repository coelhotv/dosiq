// EmptyState.jsx — estado vazio unificado para todas as telas principais
// Suporta ícone Lucide (renderizado em círculo) ou emoji string (legado).
// action: { label, onPress } — CTA primário opcional
// hint: string — dica secundária abaixo do CTA

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, spacing, borderRadius } from '../../styles/tokens'

export default function EmptyState({
  title = undefined,
  message = 'Nenhum dado encontrado',
  icon = '💊',
  action = null,
  hint = null,
}: {
  // TODO(040-strict): tipar de verdade (icon: ReactNode | string, action: { label, onPress })
  title?: any
  message?: string
  icon?: any
  action?: any
  hint?: any
}) {
  const isReactElement = icon !== null && typeof icon === 'object'

  return (
    <View style={styles.container}>
      {isReactElement ? (
        <View style={styles.iconCircle}>{icon}</View>
      ) : (
        <Text style={styles.iconEmoji}>{icon}</Text>
      )}
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.message}>{message}</Text>
      {action ? (
        <Pressable style={styles.actionBtn} onPress={action.onPress} accessibilityRole="button">
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[6],
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  iconEmoji: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  message: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  actionBtn: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.primary,
    width: '100%',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.inverse,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing[4],
    maxWidth: 280,
    lineHeight: 19,
  },
})
