import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native'
import { parseISO } from '@dosiq/core'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { colors } from '@shared/styles/tokens'

const COLORS = {
  teal: colors.brand.primary,
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  background: colors.bg.screen,
  card: colors.bg.card,
  gray: colors.neutral[200],
  yellow: '#d97706',
}

function getMondayOf(dateStr) {
  const d = parseISO(dateStr + 'T12:00:00')
  const day = d.getDay() // 0=Dom
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return formatDate(d)
}

function shiftDays(dateStr, n) {
  const d = parseISO(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return formatDate(d)
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Converte UTC ISO para "YYYY-MM-DD" no tz do usuário — espelha utcToLocalDateStr do hook.
// Necessário para doses às 22h+ local (= dia seguinte em UTC) aparecerem no dia correto.
function toLocalDateStr(utcIso, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parseISO(utcIso))
  } catch {
    return utcIso.slice(0, 10)
  }
}

// skipped_paused filtrado no hook; aqui só chegam taken/missed/pending/skipped_user.
// Biomarkers não têm scheduled_for — guarda obrigatória (spec 033, type==='biomarker').
function getDotStatus(dayStr, instances, tz) {
  const dayInstances = instances.filter(i =>
    i.type === 'dose' &&
    i.scheduled_for &&
    toLocalDateStr(i.scheduled_for, tz) === dayStr && i.status !== 'skipped_paused'
  )
  if (dayInstances.length === 0) return COLORS.gray

  const allTaken = dayInstances.every(i => i.status === 'taken')
  if (allTaken) return COLORS.teal

  return COLORS.yellow
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function getMonthLabel(weekStartStr) {
  const d = parseISO(weekStartStr + 'T12:00:00')
  // Use mid-week day (Wednesday) to determine month label
  d.setDate(d.getDate() + 3)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function WeekCalendar({ selectedDay, onDaySelect, instances = [], minDay, maxDay, timezone = 'America/Sao_Paulo' }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMondayOf(selectedDay))

  // Semana-limite para navegação: segunda da semana que contém minDay/maxDay
  const minWeekStart = useMemo(() => minDay ? getMondayOf(minDay) : null, [minDay])
  const maxWeekStart = useMemo(() => maxDay ? getMondayOf(maxDay) : null, [maxDay])

  const canGoPrev = !minWeekStart || currentWeekStart > minWeekStart
  const canGoNext = !maxWeekStart || currentWeekStart < maxWeekStart

  const weekDays = useMemo(() => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = parseISO(currentWeekStart + 'T12:00:00')
      d.setDate(d.getDate() + i)
      days.push({
        dateStr: formatDate(d),
        dayOfWeek: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()],
        dayNum: d.getDate(),
      })
    }
    return days
  }, [currentWeekStart])

  const monthLabel = useMemo(() => getMonthLabel(currentWeekStart), [currentWeekStart])

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_evt, gestureState) => (
      Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 5
    ),
    onPanResponderRelease: (_evt, gestureState) => {
      const { dx } = gestureState
      if (dx > 40 && canGoPrev) setCurrentWeekStart(prev => shiftDays(prev, -7))
      else if (dx < -40 && canGoNext) setCurrentWeekStart(prev => shiftDays(prev, 7))
    },
  }), [canGoPrev, canGoNext])

  const handlePrevWeek = useCallback(() => {
    if (canGoPrev) setCurrentWeekStart(prev => shiftDays(prev, -7))
  }, [canGoPrev])
  const handleNextWeek = useCallback(() => {
    if (canGoNext) setCurrentWeekStart(prev => shiftDays(prev, 7))
  }, [canGoNext])

  return (
    <View style={styles.container}>
      {/* Month header with nav */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevWeek} accessibilityRole="button" disabled={!canGoPrev} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={canGoPrev ? styles.navBtn : styles.navBtnDisabled}>
          <ChevronLeft size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={handleNextWeek} accessibilityRole="button" disabled={!canGoNext} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={canGoNext ? styles.navBtn : styles.navBtnDisabled}>
          <ChevronRight size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Week Grid */}
      <View style={styles.weekGrid} {...panResponder.panHandlers}>
        {weekDays.map(day => {
          const isSelected = day.dateStr === selectedDay
          const dotColor = getDotStatus(day.dateStr, instances, timezone)

          return (
            <TouchableOpacity
              key={day.dateStr}
              style={[
                styles.dayColumn,
                isSelected && { backgroundColor: COLORS.teal },
              ]}
              onPress={() => onDaySelect(day.dateStr)}
              accessibilityRole="button"
              accessibilityLabel={`${day.dayOfWeek} ${day.dayNum}`}
            >
              <Text style={[styles.dayOfWeek, isSelected && styles.dayOfWeekSelected]}>
                {day.dayOfWeek}
              </Text>
              <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                {day.dayNum}
              </Text>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Swipe hint */}
      <View style={styles.hintRow}>
        <View style={styles.hintLine} />
        <Text style={styles.hintText}>Deslize entre semanas</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayColumn: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayOfWeek: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  dayOfWeekSelected: {
    color: COLORS.card,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  dayNumberSelected: {
    color: COLORS.card,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
  },
  hintLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.teal,
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  navBtn: {
    opacity: 1,
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
})
