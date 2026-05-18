// TreatmentPrimitivesDemoScreen — playground primitivos Fase 2 (Sprint T2.2).
// DEV-only. Cada bloco isolado para validar interação visual antes da integração no form.

import { useState } from 'react'
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing, typography } from '@shared/styles/tokens'
import WeekdaySelector from '../../treatments/components/WeekdaySelector'
import MedicineSelectorRow from '../../treatments/components/MedicineSelectorRow'
import TimeSchedulePicker from '../../treatments/components/TimeSchedulePicker'

const FAKE_MEDICINE = {
  id: 'demo-med-1',
  name: 'SeloZok',
  dosage_per_pill: 50,
  dosage_unit: 'mg',
  type: 'medicamento',
  laboratory: 'AstraZeneca',
  active_ingredient: 'Metoprolol',
}

const FAKE_SUPPLEMENT = {
  id: 'demo-supp-1',
  name: 'Vitamina D3',
  dosage_per_pill: 2000,
  dosage_unit: 'ui',
  type: 'suplemento',
  laboratory: 'Now Foods',
}

export default function TreatmentPrimitivesDemoScreen({ navigation }) {
  // States
  const [weekdays, setWeekdays] = useState(['segunda', 'quarta', 'sexta'])
  const [weekdaysError, setWeekdaysError] = useState(false)
  const [medicine, setMedicine] = useState(null)
  const [times, setTimes] = useState(['08:00', '20:00'])
  const [timesError, setTimesError] = useState(false)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Primitivos T2.2</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── WeekdaySelector ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WeekdaySelector</Text>
          <Text style={styles.caption}>Toque dias; toggle on/off. Toggle erro pra ver hint.</Text>
          <WeekdaySelector
            value={weekdays}
            onChange={setWeekdays}
            error={weekdaysError ? 'Selecione ao menos um dia' : null}
          />
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => setWeekdaysError((v) => !v)}
            >
              <Text style={styles.controlBtnText}>
                Toggle erro ({weekdaysError ? 'ON' : 'OFF'})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={() => setWeekdays([])}>
              <Text style={styles.controlBtnText}>Limpar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.stateLabel}>State: {JSON.stringify(weekdays)}</Text>
        </View>

        {/* ── MedicineSelectorRow ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MedicineSelectorRow</Text>
          <Text style={styles.caption}>
            Estado vazio + selecionado (medicamento) + selecionado (suplemento).
          </Text>

          <Text style={styles.subLabel}>Vazio:</Text>
          <MedicineSelectorRow
            medicine={null}
            onPress={() => setMedicine(FAKE_MEDICINE)}
          />

          <Text style={styles.subLabel}>Selecionado (medicamento):</Text>
          <MedicineSelectorRow
            medicine={FAKE_MEDICINE}
            onPress={() => setMedicine(FAKE_SUPPLEMENT)}
          />

          <Text style={styles.subLabel}>Selecionado (suplemento — cor laranja):</Text>
          <MedicineSelectorRow
            medicine={FAKE_SUPPLEMENT}
            onPress={() => setMedicine(null)}
          />

          <Text style={styles.subLabel}>Controlado (toca pra alternar fake/null):</Text>
          <MedicineSelectorRow
            medicine={medicine}
            onPress={() => setMedicine(medicine ? null : FAKE_MEDICINE)}
            error={medicine ? null : 'Selecione o medicamento'}
          />
        </View>

        {/* ── TimeSchedulePicker ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TimeSchedulePicker</Text>
          <Text style={styles.caption}>
            Adicionar/editar/remover horários (iOS modal spinner; Android picker nativo).
          </Text>
          <TimeSchedulePicker
            value={times}
            onChange={setTimes}
            error={timesError ? 'Adicione ao menos um horário' : null}
            maxItems={10}
          />
          <View style={styles.controls}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => setTimesError((v) => !v)}
            >
              <Text style={styles.controlBtnText}>
                Toggle erro ({timesError ? 'ON' : 'OFF'})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={() => setTimes([])}>
              <Text style={styles.controlBtnText}>Limpar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.stateLabel}>State: {JSON.stringify(times)}</Text>
        </View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen || colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  backBtn: {
    padding: spacing[1],
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    padding: spacing[4],
    gap: spacing[6],
  },
  section: {
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.neutral[50],
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing[2],
  },
  caption: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  controlBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.neutral[100],
    borderRadius: 8,
  },
  controlBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  stateLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: 'Courier',
  },
})
