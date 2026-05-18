// ProtocolFormBody.jsx — sub-componente de render do ProtocolFormScreen.
// Isola as 6 seções (Medicamento, Info, Frequência, Período, Organização,
// Observações) pra manter o screen principal enxuto.

import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { parseLocalDate } from '@dosiq/core'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormDatePicker from '@shared/components/form/FormDatePicker'
import MedicineSelectorRow from '@treatments/components/MedicineSelectorRow'
import WeekdaySelector from '@treatments/components/WeekdaySelector'
import TimeSchedulePicker from '@treatments/components/TimeSchedulePicker'
import PlanSelectField from '@treatments/components/PlanSelectField'
import { colors, spacing } from '@shared/styles/tokens'

const FREQUENCY_OPTIONS = [
  { value: 'diário', label: 'Diário' },
  { value: 'dias_alternados', label: 'Dias alternados' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'quando_necessário', label: 'Quando necessário' },
]

const REQUIRES_WEEKDAYS = new Set(['semanal', 'personalizado'])

export default function ProtocolFormBody({
  form,
  medicine,
  onOpenMedicineSheet,
  plans,
  planField,
  onPlanFieldChange,
  onDoseChange,
  onStartDateChange,
  onEndDateChange,
}) {
  const showWeekdays = REQUIRES_WEEKDAYS.has(form.values.frequency)

  const startDateAsDate = useMemo(
    () => (form.values.start_date ? parseLocalDate(form.values.start_date) : null),
    [form.values.start_date]
  )
  const endDateAsDate = useMemo(
    () => (form.values.end_date ? parseLocalDate(form.values.end_date) : null),
    [form.values.end_date]
  )

  const doseDisplay =
    form.values.dosage_per_intake === ''
      ? ''
      : String(form.values.dosage_per_intake).replace('.', ',')

  return (
    <>
      <Section title="Medicamento">
        <MedicineSelectorRow
          medicine={medicine}
          onPress={onOpenMedicineSheet}
          error={form.touched.medicine_id ? form.errors.medicine_id : null}
        />
      </Section>

      <Section title="Informações básicas">
        <FormInput
          name="name"
          label="Nome do tratamento"
          value={form.values.name}
          error={form.touched.name ? form.errors.name : null}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          placeholder="Ex: Hipertensão"
          maxLength={200}
          required
        />
        <FormInput
          name="dosage_per_intake"
          label="Dose por tomada"
          value={doseDisplay}
          error={form.touched.dosage_per_intake ? form.errors.dosage_per_intake : null}
          onChange={onDoseChange}
          onBlur={form.handleBlur}
          placeholder="0"
          keyboardType="decimal-pad"
          maxLength={10}
          helperText="Quantas unidades do medicamento por tomada (aceita decimais, ex: 0,5)"
          required
        />
      </Section>

      <Section title="Frequência">
        <FormSelect
          name="frequency"
          label="Periodicidade"
          value={form.values.frequency}
          options={FREQUENCY_OPTIONS}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          error={form.touched.frequency ? form.errors.frequency : null}
          required
        />
        {showWeekdays ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Dias da semana</Text>
            <WeekdaySelector
              value={form.values.weekdays}
              onChange={(next) => form.handleChange('weekdays', next)}
              error={form.touched.weekdays ? form.errors.weekdays : null}
            />
          </View>
        ) : null}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Horários</Text>
          <TimeSchedulePicker
            value={form.values.time_schedule}
            onChange={(next) => form.handleChange('time_schedule', next)}
            error={form.touched.time_schedule ? form.errors.time_schedule : null}
          />
        </View>
      </Section>

      <Section title="Período">
        <View style={styles.dateRow}>
          <View style={styles.flex}>
            <FormDatePicker
              name="start_date"
              label="Início"
              value={startDateAsDate}
              onChange={onStartDateChange}
              error={form.touched.start_date ? form.errors.start_date : null}
            />
          </View>
          <View style={styles.flex}>
            <FormDatePicker
              name="end_date"
              label="Término"
              value={endDateAsDate}
              onChange={onEndDateChange}
              error={form.touched.end_date ? form.errors.end_date : null}
              helperText="Sem prazo = uso contínuo"
              minimumDate={startDateAsDate}
            />
          </View>
        </View>
      </Section>

      <Section title="Organização">
        <PlanSelectField
          plans={plans}
          value={planField}
          onChange={onPlanFieldChange}
          error={form.touched.treatment_plan_id ? form.errors.treatment_plan_id : null}
        />
      </Section>

      <Section title="Observações">
        <FormInput
          name="notes"
          label="Notas"
          value={form.values.notes}
          error={form.touched.notes ? form.errors.notes : null}
          onChange={form.handleChange}
          onBlur={form.handleBlur}
          placeholder="Notas sobre este tratamento…"
          multiline
          numberOfLines={4}
          maxLength={1000}
          helperText="Opcional"
        />
      </Section>
    </>
  )
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionBody: {
    gap: spacing[3],
  },
  fieldBlock: {
    gap: spacing[2],
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
})
