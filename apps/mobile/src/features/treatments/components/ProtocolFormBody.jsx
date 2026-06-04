// ProtocolFormBody.jsx — sub-componente de render do ProtocolFormScreen.
// Isola as 6 seções (Medicamento, Info, Frequência, Período, Organização,
// Observações) pra manter o screen principal enxuto.

import { useMemo, useCallback } from 'react'
import { View, Text, Switch, Alert, Linking, StyleSheet } from 'react-native'
import { parseLocalDate, formatActiveIngredientFormula } from '@dosiq/core'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormDatePicker from '@shared/components/form/FormDatePicker'
import MedicineSelectorRow from '@treatments/components/MedicineSelectorRow'
import WeekdaySelector from '@treatments/components/WeekdaySelector'
import TimeSchedulePicker from '@treatments/components/TimeSchedulePicker'
import PlanSelectField from '@treatments/components/PlanSelectField'
import { colors, spacing } from '@shared/styles/tokens'
import { ensurePushPermission } from '@platform/notifications/pushPermission'

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
  const handleCriticalAlarmToggle = useCallback(async (next) => {
    if (next) {
      // R-239: checar permissão no ponto de intenção
      const { granted, blocked } = await ensurePushPermission()
      if (!granted) {
        if (blocked) {
          Alert.alert(
            'Permissão necessária',
            'Para ativar o alarme crítico, permita notificações nas Configurações do sistema.',
            [
              { text: 'Agora não', style: 'cancel' },
              { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
            ]
          )
        }
        return
      }
    }
    form.handleChange('critical_alarm', next)
  }, [form])
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

  const helperText = useMemo(() => {
    if (!medicine) {
      return 'Quantas unidades do medicamento por tomada (aceita decimais, ex: 0,5)'
    }
    const formula = formatActiveIngredientFormula(
      form.values.dosage_per_intake,
      medicine.dosage_per_pill,
      medicine.dosage_unit
    )
    return formula ? `✨ ${formula}` : 'Quantas unidades do medicamento por tomada (aceita decimais, ex: 0,5)'
  }, [form.values.dosage_per_intake, medicine])

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
          helperText={helperText}
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

      <Section title="Alertas">
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Alerta crítico</Text>
            <Text style={styles.toggleHint}>
              Toca mesmo no silencioso. Use só para doses inegociáveis (ex: imunossupressor, insulina).
            </Text>
          </View>
          <Switch
            value={!!form.values.critical_alarm}
            onValueChange={handleCriticalAlarmToggle}
            trackColor={{ false: colors.border?.default, true: colors.brand.primary }}
            thumbColor={form.values.critical_alarm ? colors.bg.card : colors.text?.secondary}
            accessibilityLabel="Alerta crítico"
          />
        </View>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  toggleText: {
    flex: 1,
    gap: spacing[1],
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text?.primary,
  },
  toggleHint: {
    fontSize: 13,
    color: colors.text?.secondary,
    lineHeight: 18,
  },
})
