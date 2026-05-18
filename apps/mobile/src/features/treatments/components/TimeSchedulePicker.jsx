// TimeSchedulePicker.jsx — seletor de horários múltiplos para Protocol (Fase 2 T2.1).
// Spec §3.4 — variação "Chips" (lista vertical de cards).
//
// API:
//   value: string[] — array de "HH:MM" (24h)
//   onChange: (string[]) => void
//   error?: string
//   maxItems?: number — default 10 (R-022 limite Zod)

import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Platform, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Clock, X, Plus } from 'lucide-react-native'
import { getNow } from '@dosiq/core'
import { selectionTap, lightTap } from '@shared/utils/haptics'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const MAX_ITEMS_DEFAULT = 10
const BACKDROP_COLOR = 'rgba(0,0,0,0.4)'

// "HH:MM" → Date (hoje + esses horários) — usa getNow() para R-020 compliance
function stringToDate(timeStr) {
  const [hh, mm] = (timeStr || '08:00').split(':').map((n) => parseInt(n, 10) || 0)
  const d = getNow()
  d.setHours(hh, mm, 0, 0)
  return d
}

// Date → "HH:MM" zero-padded
function dateToString(d) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function TimeSchedulePicker({
  value = [],
  onChange,
  error,
  maxItems = MAX_ITEMS_DEFAULT,
}) {
  // States
  const [editIndex, setEditIndex] = useState(null) // null = picker fechado; -1 = add novo; >=0 = editar slot
  const [tempDate, setTempDate] = useState(() => stringToDate('08:00'))

  // Memos
  const canAddMore = useMemo(() => value.length < maxItems, [value.length, maxItems])
  const isOpen = editIndex !== null

  // Handlers
  const closePicker = useCallback(() => {
    setEditIndex(null)
  }, [])

  // commitTimeAt recebe idx explicito — evita capturar editIndex via closure
  // (no Android o picker imperativo dispara onChange ANTES do setState assíncrono
  // re-renderizar; usar idx do closure direto é confiável em ambos os OS).
  const commitTimeAt = useCallback(
    (idx, date) => {
      const newTime = dateToString(date)
      const next = [...value]
      if (idx === -1) {
        if (!next.includes(newTime)) next.push(newTime)
      } else if (idx >= 0) {
        // Editar para um horário que já existe em outro slot = no-op (evita
        // duplicata silenciosa pós-sort). Trocar para o mesmo valor é OK.
        if (next.includes(newTime) && next[idx] !== newTime) return
        next[idx] = newTime
      }
      next.sort()
      onChange(next)
      selectionTap()
    },
    [value, onChange]
  )

  const openEditor = useCallback(
    (idx) => {
      if (idx === -1 && !canAddMore) return
      lightTap()
      const seed = idx >= 0 ? stringToDate(value[idx]) : stringToDate('08:00')

      if (Platform.OS === 'android') {
        // Android: picker imperativo nativo — commit inline via idx do closure
        DateTimePickerAndroid.open({
          value: seed,
          mode: 'time',
          is24Hour: true,
          onChange: (event, selectedDate) => {
            if (event.type === 'set' && selectedDate) commitTimeAt(idx, selectedDate)
          },
        })
      } else {
        // iOS: modal controlado por state (re-render acontece antes do OK)
        setTempDate(seed)
        setEditIndex(idx)
      }
    },
    [value, canAddMore, commitTimeAt]
  )

  const removeAt = useCallback(
    (idx) => {
      lightTap()
      onChange(value.filter((_, i) => i !== idx))
    },
    [value, onChange]
  )

  const onIosChange = useCallback((_, selectedDate) => {
    if (selectedDate) setTempDate(selectedDate)
  }, [])

  const onIosConfirm = useCallback(() => {
    if (editIndex !== null) commitTimeAt(editIndex, tempDate)
    closePicker()
  }, [commitTimeAt, closePicker, editIndex, tempDate])

  return (
    <View>
      <View style={styles.list}>
        {value.map((t, idx) => (
          <View key={`${t}-${idx}`} style={styles.row}>
            <Pressable
              onPress={() => openEditor(idx)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Editar horário ${t}`}
            >
              <Clock size={20} color={colors.primary[600]} />
              <Text style={styles.time}>{t}</Text>
            </Pressable>
            <Pressable
              onPress={() => removeAt(idx)}
              style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Remover horário ${t}`}
              hitSlop={8}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={() => openEditor(-1)}
          disabled={!canAddMore}
          style={({ pressed }) => [
            styles.addBtn,
            error && styles.addBtnError,
            (pressed || !canAddMore) && styles.addBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Adicionar horário"
          accessibilityState={{ disabled: !canAddMore }}
        >
          <Plus size={16} color={error ? colors.status.error : colors.primary[700]} />
          <Text style={[styles.addBtnText, error && styles.addBtnTextError]}>
            {canAddMore ? 'Adicionar horário' : `Máximo de ${maxItems} horários`}
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* iOS modal (Android usa picker imperativo) */}
      {Platform.OS === 'ios' && isOpen ? (
        <Modal transparent animationType="slide" visible onRequestClose={closePicker}>
          <Pressable style={styles.backdrop} onPress={closePicker} />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={closePicker} hitSlop={8}>
                <Text style={styles.sheetCancel}>Cancelar</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>
                {editIndex === -1 ? 'Adicionar horário' : 'Editar horário'}
              </Text>
              <Pressable onPress={onIosConfirm} hitSlop={8}>
                <Text style={styles.sheetConfirm}>OK</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="time"
              is24Hour
              display="spinner"
              onChange={onIosChange}
              themeVariant="light"
            />
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
  },
  cardPressed: {
    opacity: 0.7,
  },
  time: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  removeBtnPressed: {
    opacity: 0.6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
  },
  addBtnError: {
    backgroundColor: colors.neutral[100],
  },
  addBtnPressed: {
    opacity: 0.6,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
  addBtnTextError: {
    color: colors.status.error,
  },
  error: {
    color: colors.status.error,
    fontSize: 12,
    marginTop: spacing[2],
  },
  backdrop: {
    flex: 1,
    backgroundColor: BACKDROP_COLOR,
  },
  sheet: {
    backgroundColor: colors.bg.screen || colors.neutral[50],
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing[2],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sheetCancel: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  sheetConfirm: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[700],
  },
})
