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
import MeasureDetailSheet from '@features/measures/components/MeasureDetailSheet'
import MeasureLogSheet from '@features/measures/components/MeasureLogSheet'
import { measuresRepo } from '@features/measures/services/measuresRepo'

const WEEK_DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function formatDayHeader(dateStr) {
  const d = parseISO(dateStr + 'T12:00:00')
  return `${WEEK_DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

export default function HistoryScreen() {
  const navigation = useNavigation()
  const { instances, selectedDay, setSelectedDay, kpis, instancesForDay, timezone, minDay, maxDay, refresh } = useHistoryData()
  const [sheetInstance, setSheetInstance] = useState(null)
  // detailMeasure: shape normalizado para MeasureDetailSheet ({id, type, value, ...})
  const [detailMeasure, setDetailMeasure] = useState(null)
  const [editMeasure, setEditMeasure] = useState(null)
  const [measureLogOpen, setMeasureLogOpen] = useState(false)

  const mutation = useHistoryMutation({ onSuccess: refresh })

  const dayLabel = useMemo(() => formatDayHeader(selectedDay), [selectedDay])
  // Chip conta só doses (FR-005, ADR-054 — biomarkers excluídos da contagem)
  const doseCount = useMemo(
    () => instancesForDay.filter(ev => ev.type === 'dose').length,
    [instancesForDay]
  )

  const handleItemPress = useCallback((inst) => {
    if (inst.type === 'biomarker') {
      // Normaliza shape do histórico → shape esperado por MeasureDetailSheet
      setDetailMeasure({
        id: inst.biomarkerId,
        type: inst.bioType,
        value: inst.value,
        value_secondary: inst.value_secondary ?? null,
        unit: inst.unit ?? null,
        context: inst.context ?? null,
        measured_at: inst.measured_at,
      })
    } else {
      setSheetInstance(inst)
    }
  }, [])

  const handleSheetClose = useCallback(() => setSheetInstance(null), [])

  // Editar via MeasureDetailSheet → abre MeasureLogSheet (mesmo fluxo de MeasuresScreen)
  const handleDetailMeasureEdit = useCallback((item) => {
    setDetailMeasure(null)
    setEditMeasure(item)
    setMeasureLogOpen(true)
  }, [])

  const handleDetailMeasureDelete = useCallback(async (item) => {
    await measuresRepo.remove(item.id)
    setDetailMeasure(null)
    refresh()
  }, [refresh])

  const handleMeasureLogClose = useCallback(() => {
    setMeasureLogOpen(false)
    setEditMeasure(null)
  }, [])

  const handleMeasureSaved = useCallback(async (payload) => {
    let result
    if (payload?.id) {
      const { id, ...patch } = payload
      result = await measuresRepo.update(id, patch)
    } else {
      result = await measuresRepo.create(payload)
    }
    handleMeasureLogClose()
    refresh()
    return result
  }, [handleMeasureLogClose, refresh])

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
          minDay={minDay}
          maxDay={maxDay}
          timezone={timezone}
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
        onUpdateLog={mutation.updateLog}
        onDeleteLog={mutation.deleteLog}
        loading={mutation.loading}
      />

      {/* Detalhe de medida — mesmo sheet do Histórico de Medidas (consistência de UX) */}
      <MeasureDetailSheet
        open={!!detailMeasure}
        item={detailMeasure}
        onClose={() => setDetailMeasure(null)}
        onEdit={handleDetailMeasureEdit}
        onDelete={handleDetailMeasureDelete}
      />

      {/* Edição inline de medida (SC-005 — sem navegar para MeasuresScreen) */}
      <MeasureLogSheet
        key={editMeasure?.id ?? 'create-measure'}
        open={measureLogOpen}
        onClose={handleMeasureLogClose}
        onSaved={handleMeasureSaved}
        editItem={editMeasure}
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
