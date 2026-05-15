import { View, Text, TouchableOpacity, Modal, Platform, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Clock } from 'lucide-react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { getNow } from '@dosiq/core'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

// Formata horário no padrão HH:mm (24h)
const defaultFormat = (d) => {
  if (!d) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function FormTimePicker({
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
  format,
}) {
  const [open, setOpen] = useState(false)
  // Valor temporário usado no picker iOS antes de confirmar
  const [tempValue, setTempValue] = useState(() => value ?? getNow())

  const formatter = format ?? defaultFormat
  const hasValue = value != null

  // Cor da borda: erro > aberto/focused > padrão
  const borderColor = error
    ? colors.status.error
    : open
    ? colors.primary[700]
    : colors.border.default

  function handleOpen() {
    if (disabled) return

    if (Platform.OS === 'android') {
      // Android: picker imperativo nativo (evita edge cases de JSX montado)
      DateTimePickerAndroid.open({
        value: value ?? getNow(),
        mode: 'time',
        display: 'default',
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            onChange?.(name, date)
          }
          onBlur?.(name)
        },
      })
    } else {
      // iOS: abre modal com spinner
      setTempValue(value ?? getNow())
      setOpen(true)
    }
  }

  function handleIOSConfirm() {
    onChange?.(name, tempValue)
    setOpen(false)
    onBlur?.(name)
  }

  function handleIOSCancel() {
    setOpen(false)
    onBlur?.(name)
  }

  function handleIOSChange(_, date) {
    if (date) setTempValue(date)
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

      {/* Trigger */}
      <TouchableOpacity
        style={[styles.trigger, { borderColor }]}
        onPress={handleOpen}
        activeOpacity={0.8}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={placeholder}
        accessibilityState={{ disabled, expanded: open }}
      >
        <Text
          style={[styles.triggerText, !hasValue && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {hasValue ? formatter(value) : (placeholder ?? 'Selecionar horário')}
        </Text>
        <Clock size={18} color={colors.text.muted} strokeWidth={2} />
      </TouchableOpacity>

      {/* Erro / helper */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      {/* Modal iOS com spinner */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={handleIOSCancel}
        >
          {/* Backdrop semi-transparente */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={handleIOSCancel}
          />

          {/* Sheet deslizante inferior */}
          <View style={styles.sheet}>
            <SafeAreaView edges={['bottom']}>
              {/* Cabeçalho com ações */}
              <View style={styles.sheetHeader}>
                <TouchableOpacity
                  onPress={handleIOSCancel}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar"
                >
                  <Text style={styles.headerActionCancel}>Cancelar</Text>
                </TouchableOpacity>

                <Text style={styles.sheetTitle}>Selecionar horário</Text>

                <TouchableOpacity
                  onPress={handleIOSConfirm}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Confirmar"
                >
                  <Text style={styles.headerActionConfirm}>Confirmar</Text>
                </TouchableOpacity>
              </View>

              {/* Picker spinner.
                  textColor + themeVariant explícitos previnem texto invisível
                  em alguns devices iOS (dark mode forçado, accessibility,
                  iOS 14+ herdando cor do sistema). */}
              <DateTimePicker
                mode="time"
                display="spinner"
                value={tempValue}
                onChange={handleIOSChange}
                locale="pt-BR"
                textColor={colors.text.primary}
                themeVariant="light"
              />
            </SafeAreaView>
          </View>
        </Modal>
      )}
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
  trigger: {
    height: 50,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    marginRight: spacing[2],
  },
  triggerPlaceholder: {
    color: colors.text.muted,
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
  // Modal
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  sheetTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerActionCancel: {
    fontSize: 15,
    color: colors.text.muted,
    fontWeight: '500',
  },
  headerActionConfirm: {
    fontSize: 15,
    color: colors.primary[700],
    fontWeight: '600',
  },
})
