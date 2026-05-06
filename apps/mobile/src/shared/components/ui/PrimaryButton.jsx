// PrimaryButton.jsx — botão primário reutilizável do MVP mobile
// Suporta loading state com ActivityIndicator

import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { colors } from '../../styles/tokens'

export default function PrimaryButton({ label, onPress, loading = false, disabled = false, style }) {
  const isDisabled = disabled || loading

  return (
    <Pressable
      style={[styles.button, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={colors.brand.primary} size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
