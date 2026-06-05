import React, { useCallback, useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { ArrowLeft } from 'lucide-react-native'
import { parseISO } from '@dosiq/core'
import { colors } from '@shared/styles/tokens'
import { useHistoryData } from '@history/hooks/useHistoryData'
import { useHistoryMutation } from '@history/hooks/useHistoryMutation'
import WeekCalendar from '@history/components/WeekCalendar'
import DoseHistoryKpis from '@history/components/DoseHistoryKpis'
import DoseHistoryList from '@history/components/DoseHistoryList'
import DoseActionSheet from '@history/components/DoseActionSheet'

const WEEK_DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function formatDayHeader(dateStr) {
  const d = parseISO(dateStr + 'T12:00:00')
  return `${WEEK_DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

export default function HistoryScreen() {
  const navigation = useNavigation()
  const { instances, selectedDay, setSelectedDay, kpis, instancesForDay, timezone, refresh } = useHistoryData()
  const [sheetInstance, setSheetInstance] = useState(null)

  const mutation = useHistoryMutation({ onSuccess: refresh })

  const dayLabel = useMemo(() => formatDayHeader(selectedDay), [selectedDay])
  const doseCount = instancesForDay.length

  const handleItemPress = useCallback((inst) => {
    setSheetInstance(inst)
  }, [])

  const handleSheetClose = useCallback(() => {
    setSheetInstance(null)
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header de navegação */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de Doses</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DoseHistoryKpis kpis={kpis} />
        <WeekCalendar
          selectedDay={selectedDay}
          onDaySelect={setSelectedDay}
          instances={instances}
        />

        {/* Day header */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayLabel}>{dayLabel}</Text>
          {doseCount > 0 && (
            <View style={styles.doseBadge}>
              <Text style={styles.doseBadgeText}>{doseCount} {doseCount === 1 ? 'DOSE' : 'DOSES'}</Text>
            </View>
          )}
        </View>

        <DoseHistoryList
          instances={instancesForDay}
          timezone={timezone}
          onItemPress={handleItemPress}
        />
      </ScrollView>

      <DoseActionSheet
        visible={!!sheetInstance}
        instance={sheetInstance}
        timezone={timezone}
        onClose={handleSheetClose}
        onRegisterRetro={mutation.registerRetro}
        onUndo={mutation.undo}
        loading={mutation.loading}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: colors.bg.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  doseBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  doseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand.primary,
    letterSpacing: 0.3,
  },
})
