import { View, Text, Pressable, StyleSheet } from 'react-native'
import { WEEKDAYS } from '@dosiq/core'
import { selectionTap } from '@shared/utils/haptics'
import { colors, spacing } from '@shared/styles/tokens'

// Ordem visual brasileira (Dom-Sáb) → canônico WEEKDAYS
const VISUAL_ORDER = [
  { key: 'domingo', label: 'D' },
  { key: 'segunda', label: 'S' },
  { key: 'terça', label: 'T' },
  { key: 'quarta', label: 'Q' },
  { key: 'quinta', label: 'Q' },
  { key: 'sexta', label: 'S' },
  { key: 'sábado', label: 'S' },
]

export default function WeekdaySelector({ value = [], onChange, error }) {
  // (componente controlado — value/onChange via props; sem state interno)
  // Handlers (R-010 — States → Memos → Effects → Handlers)
  const handleToggle = (day) => {
    if (!WEEKDAYS.includes(day)) return
    const isSelected = value.includes(day)
    const next = isSelected ? value.filter((d) => d !== day) : [...value, day]
    onChange(next)
    selectionTap()
  }

  return (
    <View>
      <View style={styles.row}>
        {VISUAL_ORDER.map(({ key, label }) => {
          const isSelected = value.includes(key)
          return (
            <Pressable
              key={key}
              onPress={() => handleToggle(key)}
              accessibilityRole="checkbox"
              accessibilityLabel={`Selecionar ${key}`}
              accessibilityState={{ checked: isSelected }}
              style={({ pressed }) => [
                styles.button,
                isSelected ? styles.buttonSelected : styles.buttonUnselected,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.label,
                  isSelected ? styles.labelSelected : styles.labelUnselected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    // Sem paddingHorizontal próprio — primitivo atômico delega ao container pai
    // (FormSection / ProtocolFormScreen). space-between distribui os 7 botões
    // dentro da largura disponível.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: colors.primary[500],
  },
  buttonUnselected: {
    backgroundColor: colors.neutral[100],
  },
  buttonPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
  },
  labelSelected: {
    color: colors.text.inverse,
    fontWeight: '700',
  },
  labelUnselected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  error: {
    color: colors.status.error,
    fontSize: 12,
    marginTop: spacing[2],
  },
})
