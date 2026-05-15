import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronDown, Check, X } from 'lucide-react-native'
import { useState } from 'react'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const SCREEN_HEIGHT = Dimensions.get('window').height

export default function FormSelect({
  name,
  label,
  value,
  options,
  error,
  onChange,
  onBlur,
  disabled,
  placeholder,
  helperText,
  required,
}) {
  const [open, setOpen] = useState(false)

  const selectedOption = options?.find(o => o.value === value)
  const hasValue = selectedOption != null

  function handleOpen() {
    if (!disabled) setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    onBlur?.(name)
  }

  function handleSelect(option) {
    onChange?.(name, option.value)
    handleClose()
  }

  // Cor da borda: erro > aberto/focused > padrão
  const borderColor = error
    ? colors.status.error
    : open
    ? colors.primary[700]
    : colors.border.default

  function renderOption({ item }) {
    const isSelected = item.value === value
    return (
      <TouchableOpacity
        style={[styles.optionRow, isSelected && styles.optionRowSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        accessibilityRole="menuitem"
        accessibilityState={{ selected: isSelected }}
      >
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
          {item.label}
        </Text>
        {isSelected && (
          <Check size={18} color={colors.primary[700]} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.wrapper, disabled && styles.wrapperDisabled]}>
      {/* Label */}
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
        <Text style={[styles.triggerText, !hasValue && styles.triggerPlaceholder]} numberOfLines={1}>
          {hasValue ? selectedOption.label : (placeholder ?? 'Selecionar')}
        </Text>
        <ChevronDown size={18} color={colors.text.muted} strokeWidth={2} />
      </TouchableOpacity>

      {/* Erro / helper */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      {/* Modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        {/* Sheet */}
        <View style={styles.sheet}>
          <SafeAreaView edges={['bottom']}>
            {/* Cabeçalho */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderSpacer} />
              <Text style={styles.sheetTitle}>
                {label ? `Selecionar ${label}` : 'Selecionar'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <X size={20} color={colors.text.secondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Divisor */}
            <View style={styles.divider} />

            {/* Lista de opções */}
            <FlatList
              data={options}
              keyExtractor={(item, idx) => String(item.value ?? idx)}
              renderItem={renderOption}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </SafeAreaView>
        </View>
      </Modal>
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
    maxHeight: SCREEN_HEIGHT * 0.6,
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
  sheetHeaderSpacer: {
    width: 32,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    alignItems: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing[4],
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: spacing[2],
  },
  optionRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    backgroundColor: colors.bg.card,
  },
  optionRowSelected: {
    backgroundColor: colors.primary[50],
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    marginRight: spacing[2],
  },
  optionTextSelected: {
    color: colors.primary[700],
    fontWeight: '600',
  },
})
