import { View, Text, TextInput, Animated, StyleSheet } from 'react-native'
import { useEffect, useState } from 'react'
import { colors, borderRadius } from '@shared/styles/tokens'

export default function FormInput({
  name,
  label,
  value,
  error,
  onChange,
  onBlur,
  disabled,
  placeholder,
  helperText,
  required,
  // Pass-through para TextInput
  keyboardType,
  autoCapitalize,
  autoComplete,
  secureTextEntry,
  multiline,
  numberOfLines,
  maxLength,
  returnKeyType,
  onSubmitEditing,
}) {
  const [focused, setFocused] = useState(false)
  // Animated.Value criado uma única vez (lazy init via useState)
  const [borderColorAnim] = useState(() => new Animated.Value(0))

  // Anima transição de cor da borda quando erro muda
  useEffect(() => {
    Animated.spring(borderColorAnim, {
      toValue: error ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 0,
    }).start()
  }, [error, borderColorAnim])

  // Interpola entre cor base (focused/default) e cor de erro
  const baseBorder = focused ? colors.primary[700] : colors.border.default
  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [baseBorder, colors.status.error],
  })

  function handleFocus() {
    setFocused(true)
  }

  function handleBlur() {
    setFocused(false)
    onBlur?.(name)
  }

  function handleChangeText(text) {
    onChange?.(name, text)
  }

  return (
    <View style={[styles.wrapper, disabled && styles.wrapperDisabled]}>
      {/* Label acima do campo */}
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.asterisk}> *</Text>}
        </View>
      ) : null}

      {/* Container animado com borda colorida */}
      <Animated.View
        style={[
          styles.inputContainer,
          multiline && styles.inputContainerMultiline,
          disabled && styles.inputContainerDisabled,
          { borderColor },
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={label}
          accessibilityHint={helperText || placeholder}
          accessibilityState={error ? { invalid: true } : undefined}
        />
      </Animated.View>

      {/* Mensagem de erro */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        // Helper só aparece quando não há erro
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    opacity: 1,
  },
  wrapperDisabled: {
    opacity: 0.6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  asterisk: {
    fontSize: 13,
    color: colors.status.error,
  },
  inputContainer: {
    height: 50,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputContainerMultiline: {
    height: undefined,
    minHeight: 96,
    paddingVertical: 12,
  },
  inputContainerDisabled: {
    backgroundColor: colors.neutral[50],
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: colors.status.error,
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 6,
  },
})
