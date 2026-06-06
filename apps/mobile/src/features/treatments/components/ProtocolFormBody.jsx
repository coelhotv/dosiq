import { useMemo, useCallback, useState } from 'react'
import { View, Text, Switch, Alert, Linking, StyleSheet, Modal, TouchableOpacity } from 'react-native'
import { parseLocalDate, formatActiveIngredientFormula } from '@dosiq/core'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormDatePicker from '@shared/components/form/FormDatePicker'
import MedicineSelectorRow from '@treatments/components/MedicineSelectorRow'
import WeekdaySelector from '@treatments/components/WeekdaySelector'
import TimeSchedulePicker from '@treatments/components/TimeSchedulePicker'
import PlanSelectField from '@treatments/components/PlanSelectField'
import { colors, spacing } from '@shared/styles/tokens'
import { enablePushAtIntent } from '@platform/notifications/pushPermission'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import {
  needsFullScreenIntentAccess,
  openFullScreenIntentSettings,
  isXiaomiDevice,
} from '@platform/alarms/alarmService'

const XIAOMI_MSG =
  'Você precisa de uma etapa extra para o alarme funcionar na tela bloqueada. Abra as configurações abaixo e:\n\n' +
  '1. Escolha "Outras permissões" e ative *Sempre permitir* em:\n' +
  '  a. "Mostrar na Tela de bloqueio"\n' +
  '  b. "Abrir novas janelas enquanto executa em segundo plano"\n' +
  '  c. "Exibir janelas pop-up"\n\n'+
  'Quando terminar, pode fechar essa janela.'

const GENERIC_MSG =
  'Para o alarme funcionar na tela bloqueada, toque em <Abrir configurações> abaixo e ligue "Notificações em tela cheia".'

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
  const [guideVisible, setGuideVisible] = useState(false)
  const [guideMsg, setGuideMsg] = useState('')

  const startDateAsDate = useMemo(
    () => (form.values.start_date ? parseLocalDate(form.values.start_date) : null),
    [form.values.start_date]
  )
  const endDateAsDate = useMemo(
    () => (form.values.end_date ? parseLocalDate(form.values.end_date) : null),
    [form.values.end_date]
  )

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

  const handleCriticalAlarmToggle = useCallback(async (next) => {
    if (next) {
      // R-239: checar permissão no ponto de intenção
      const { granted, blocked } = await enablePushAtIntent({ supabase })
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

      // Checar se precisa de acesso especial de alarme em tela cheia (Android 14+ / Xiaomi)
      if (needsFullScreenIntentAccess()) {
        setGuideMsg(isXiaomiDevice() ? XIAOMI_MSG : GENERIC_MSG)
        setGuideVisible(true)
      }
    }
    form.handleChange('critical_alarm', next)
  }, [form])
  const showWeekdays = REQUIRES_WEEKDAYS.has(form.values.frequency)

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

      <Section title="Alertas Críticos">
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            {/* <Text style={styles.toggleLabel}>Alerta crítico</Text> */}
            <Text style={styles.toggleHint}>
              O alarme tocará mesmo no silencioso. Use para doses que não podem ser esquecidas.
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

      <Section title="Prescrição">
        <View style={styles.dateRow}>
          <View style={styles.flex}>
            <FormDatePicker
              name="start_date"
              label="Data do início"
              value={startDateAsDate}
              onChange={onStartDateChange}
              error={form.touched.start_date ? form.errors.start_date : null}
            />
          </View>
          <View style={styles.flex}>
            <FormDatePicker
              name="end_date"
              label="Data do término"
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

      <Modal
        visible={guideVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setGuideVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Falta um passo no seu celular</Text>
            <Text style={styles.dialogBody}>{guideMsg}</Text>
            <TouchableOpacity
              style={[styles.dialogBtn, styles.dialogBtnPrimary]}
              onPress={() => openFullScreenIntentSettings()}
              accessibilityRole="button"
              accessibilityLabel="Abrir configurações"
            >
              <Text style={styles.dialogBtnPrimaryText}>Abrir configurações</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dialogBtn}
              onPress={() => setGuideVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Fechar aviso"
            >
              <Text style={styles.dialogBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  dialog: {
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    padding: spacing[5],
    gap: spacing[3],
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  dialogBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  dialogBtn: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnPrimary: {
    backgroundColor: colors.brand.primary,
  },
  dialogBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bg.card,
  },
  dialogBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
})
