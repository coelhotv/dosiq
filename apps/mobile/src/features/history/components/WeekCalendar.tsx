import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native'
import { parseISO } from '@dosiq/core'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, ChevronRight } = LucideIcons as any
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

// Status do ponto por dia, numa única passada (perf 071 PR2: o cálculo antigo criava um
// `Intl.DateTimeFormat` por item × 7 dias a cada render — 7,7 s no Android/Hermes com 190 itens).
// O dia local vem de `localDay`, derivado pelo core no service (mesma fonte do filtro do hook);
// fallback com UM formatter só, para item sem `localDay`. Doses às 22h+ local caem no dia certo.
// skipped_paused filtrado aqui também; biomarkers (sem scheduled_for) ficam de fora (spec 033).
function buildDotStatusByDay(instances, tz) {
  let formatter = null
  const toLocalDay = (utcIso) => {
    try {
      formatter = formatter || new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      })
      return formatter.format(parseISO(utcIso))
    } catch {
      return utcIso.slice(0, 10)
    }
  }
  const byDay = new Map()
  for (const i of instances) {
    if (i.type !== 'dose' || !i.scheduled_for || i.status === 'skipped_paused') continue
    const day = i.localDay || toLocalDay(i.scheduled_for)
    const prev = byDay.get(day)
    const allTaken = (prev === undefined || prev === COLORS.teal) && i.status === 'taken'
    byDay.set(day, allTaken ? COLORS.teal : COLORS.yellow)
  }
  return byDay
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function getMonthLabel(weekStartStr) {
  const d = parseISO(weekStartStr + 'T12:00:00')
  // Use mid-week day (Wednesday) to determine month label
  d.setDate(d.getDate() + 3)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export default function WeekCalendar({ selectedDay, onDaySelect, instances = [], minDay, maxDay, timezone = 'America/Sao_Paulo', pending = false }) {
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
  const dotStatusByDay = useMemo(() => buildDotStatusByDay(instances, timezone), [instances, timezone])

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
          // Primeira carga: sem ponto (cinza afirmaria "sem doses" antes dos dados chegarem)
          const dotColor = pending ? 'transparent' : (dotStatusByDay.get(day.dateStr) ?? COLORS.gray)

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
