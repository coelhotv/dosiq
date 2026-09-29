// NextDoseField.tsx — "Quando é a próxima dose?" + prévia das próximas datas (spec 086 US-3).
//
// Cadência em dias (`intervalo_dias`, inclusive "Mensal"). A âncora da cadência É o `start_date`:
// na CRIAÇÃO ele é perguntado como "próxima dose" (FR-016, mínimo e padrão hoje) — é o que o posto
// anota na carteirinha; na EDIÇÃO a pergunta some (FR-017) e o campo segue sendo "Data do início"
// na seção de prescrição. A prévia vem de `listUpcomingDoseDates`, a mesma recorrência do gerador de
// instâncias (INV-3): nunca prometer data em que o lembrete não toca.
//
// API:
//   values: { frequency, interval_days, time_schedule, start_date, end_date } — do form
//   askDate: boolean — criação (mostra a pergunta) × edição (só a prévia)
//   dateValue: Date | null — `start_date` como Date local
//   onDateChange: (name, Date) => void — mesmo handler do "Data do início"

import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { listUpcomingDoseDates, formatWeekdayDayMonthPtBR, formatLocalDate, parseLocalDate, getNow } from '@dosiq/core'
import { FormDatePicker } from '@shared/components/form'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const PREVIEW_COUNT = 3

export default function NextDoseField({
  values,
  askDate,
  dateValue,
  onDateChange,
  error = null,
}: {
  values: Record<string, any>
  askDate: boolean
  dateValue: Date | null
  onDateChange: (name: string, value: Date) => void
  error?: string | null
}) {
  // Memos
  const now = useMemo(() => getNow(), [])
  const today = useMemo(() => formatLocalDate(now), [now])
  const minimumDate = useMemo(() => parseLocalDate(today), [today])
  const preview = useMemo(
    () => listUpcomingDoseDates(values as never, PREVIEW_COUNT, now),
    [values, now]
  )
  const showDroppedToday = preview.todayDropped && values.start_date === today && preview.dates.length > 0

  return (
    <View style={styles.container}>
      {askDate ? (
        <FormDatePicker
          name="start_date"
          label="Quando é a próxima dose?"
          value={dateValue}
          onChange={onDateChange}
          error={error}
          minimumDate={minimumDate}
          required
        />
      ) : null}

      {preview.dates.length > 0 ? (
        <View style={styles.preview} testID="next-dose-preview" accessibilityRole="text">
          <Text style={styles.previewText}>
            Próximas doses:{' '}
            {preview.dates.map((date, i) => (
              <Text key={date} style={date === today ? styles.today : null}>
                {i > 0 ? ' · ' : ''}
                {date === today ? 'hoje' : formatWeekdayDayMonthPtBR(date)}
              </Text>
            ))}
          </Text>
          {showDroppedToday ? (
            <Text style={styles.droppedText} testID="next-dose-dropped">
              {`O horário de hoje já passou — o primeiro lembrete será em ${formatWeekdayDayMonthPtBR(preview.dates[0])}.`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  preview: {
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
  },
  previewText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  today: {
    fontWeight: '700',
    color: colors.primary[700],
    fontFamily: typography.fontFamily.bold,
  },
  droppedText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
})
