import { useMemo, useCallback, useState, useEffect } from 'react'
import { View, Text, Switch, Alert, Linking, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as LucideIcons from 'lucide-react-native'
import {
  parseLocalDate,
  formatDoseHint,
  INTAKE_UNIT_LABELS,
} from '@dosiq/core'
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

const { ArrowDownNarrowWide, ChevronRight } = LucideIcons as any

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

function useProtocolFormDerived(form, medicine) {
  const startDateAsDate = useMemo(
    () => (form.values.start_date ? parseLocalDate(form.values.start_date) : null),
    [form.values.start_date]
  )
  const endDateAsDate = useMemo(
    () => (form.values.end_date ? parseLocalDate(form.values.end_date) : null),
    [form.values.end_date]
  )

  // Líquido := dosage_unit do medicamento termina em '/ml' (decisão-mãe 022).
  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))

  const helperText = useMemo(() => {
    const fallback = 'Quantas unidades do medicamento por tomada (aceita decimais, ex: 0,5)'
    if (!medicine) return fallback
    // Reusa o formatter core (R-272) — mesma equivalência do web. Líquido:
    // mg → ml via dosage_per_pill (concentração); gotas/UI → ml via units_per_ml
    // (usa o valor que o usuário está digitando no form, se houver). Sólido: massa ativa.
    const medForHint = isLiquid
      ? {
          ...medicine,
          units_per_ml:
            Number(String(form.values.units_per_ml ?? '').replace(',', '.')) ||
            medicine.units_per_ml,
        }
      : medicine
    const hint = formatDoseHint(form.values.dosage_per_intake, form.values.intake_unit, medForHint)
    return hint ? `✨ ${hint}` : fallback
  }, [form.values.dosage_per_intake, form.values.intake_unit, form.values.units_per_ml, medicine, isLiquid])

  // Default da unidade de tomada: gotas é a apresentação líquida mais comum (mg é
  // exceção do GLP-1 — usuário troca p/ mg manualmente). ui/ml → 'UI'.
  const defaultIntake = medicine?.dosage_unit === 'ui/ml' ? 'UI' : 'gotas'
  const isMg = form.values.intake_unit === 'mg'
  // mg usa a CONCENTRAÇÃO já cadastrada (dosage_per_pill = mg/ml) — não pede densidade.
  // Dropdown dinâmico por forma (022 + B2): ui/ml → {UI, gotas}; mg/ml → {mg, ml, gotas}; resto → {gotas, ml}.
  const intakeOptions = useMemo(() => {
    const allowed =
      medicine?.dosage_unit === 'ui/ml'
        ? ['UI', 'gotas']
        : medicine?.dosage_unit === 'mg/ml'
          ? ['gotas', 'ml', 'mg']
          : ['gotas', 'ml']
    return allowed.map((u) => ({ value: u, label: INTAKE_UNIT_LABELS[u] ?? u }))
  }, [medicine?.dosage_unit])
  // Densidade (units_per_ml) só p/ gotas/UI (razão física sub-ml). mg usa a
  // concentração do medicamento (dosage_per_pill = mg/ml) — não pede densidade.
  const needsDensity =
    isLiquid && form.values.intake_unit && form.values.intake_unit !== 'ml' && !isMg
  const densityLabel = form.values.intake_unit === 'UI' ? '💧 Densidade: UI por ml' : '💧 Densidade: Gotas por ml'
  const densityHint =
    form.values.intake_unit === 'UI' ? 'Geralmente 100 UI por ml' : 'Geralmente 20 gotas por ml'
  const defaultDensity = form.values.intake_unit === 'UI' ? 100 : 20
  // gotas/UI herdam units_per_ml do medicamento (decisão 022).
  const inheritedDensity = Number(medicine?.units_per_ml) > 0 ? medicine.units_per_ml : null
  const askDensity = needsDensity && !inheritedDensity

  // Sincroniza flag transiente p/ o refine do protocolCreateSchema + default de intake_unit.
  useEffect(() => {
    if (form.values._medicineIsLiquid !== isLiquid) {
      form.handleChange('_medicineIsLiquid', isLiquid)
    }
    if (isLiquid && !form.values.intake_unit) {
      form.handleChange('intake_unit', defaultIntake)
    }
  }, [isLiquid, defaultIntake, form])

  // Densidade do form: herda do medicamento se já cadastrada (não repergunta);
  // senão prefilla o default de gotas/UI. mg sem herança fica vazio (FR-018).
  useEffect(() => {
    if (!needsDensity || form.values.units_per_ml) return
    if (inheritedDensity) form.handleChange('units_per_ml', String(inheritedDensity))
    else if (defaultDensity) form.handleChange('units_per_ml', String(defaultDensity))
  }, [needsDensity, inheritedDensity, defaultDensity, form])

  const doseDisplay =
    form.values.dosage_per_intake === ''
      ? ''
      : String(form.values.dosage_per_intake).replace('.', ',')

  return {
    startDateAsDate,
    endDateAsDate,
    isLiquid,
    helperText,
    defaultIntake,
    intakeOptions,
    askDensity,
    densityLabel,
    densityHint,
    defaultDensity,
    doseDisplay,
  }
}

function DoseSection({
  isLiquid,
  doseDisplay,
  intakeOptions,
  defaultIntake,
  helperText,
  askDensity,
  densityLabel,
  densityHint,
  defaultDensity,
  onDoseChange,
  form,
}) {
  if (isLiquid) {
    return (
      <>
        <View style={styles.doseRow}>
          <View style={styles.doseField}>
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
              required
            />
          </View>
          <View style={styles.unitField}>
            <FormSelect
              name="intake_unit"
              label="💧 Unidade"
              value={form.values.intake_unit || defaultIntake}
              options={intakeOptions}
              onChange={form.handleChange}
              onBlur={form.handleBlur}
              error={form.touched.intake_unit ? form.errors.intake_unit : null}
              required
            />
          </View>
        </View>
        {!!helperText && <Text style={styles.doseHint}>{helperText}</Text>}
        {askDensity && (
          <FormInput
            name="units_per_ml"
            label={densityLabel}
            value={form.values.units_per_ml != null ? String(form.values.units_per_ml) : ''}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            placeholder={String(defaultDensity)}
            keyboardType="decimal-pad"
            maxLength={6}
            helperText={densityHint}
          />
        )}
      </>
    )
  }

  return (
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
  )
}

function GuideModal({ visible, guideMsg, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
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
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar aviso"
          >
            <Text style={styles.dialogBtnText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function FrequencySection({ form, showWeekdays }) {
  return (
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
  )
}

function PrescriptionSection({ startDateAsDate, endDateAsDate, onStartDateChange, onEndDateChange, form }) {
  return (
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
  )
}

export default function ProtocolFormBody({
  form,
  medicine,
  onOpenMedicineSheet,
  onOpenTitration,
  isEditMode,
  titrationStepCount = 0,
  plans,
  planField,
  onPlanFieldChange,
  onDoseChange,
  onStartDateChange,
  onEndDateChange,
}) {
  const [guideVisible, setGuideVisible] = useState(false)
  const [guideMsg, setGuideMsg] = useState('')

  const {
    startDateAsDate,
    endDateAsDate,
    isLiquid,
    helperText,
    defaultIntake,
    intakeOptions,
    askDensity,
    densityLabel,
    densityHint,
    defaultDensity,
    doseDisplay,
  } = useProtocolFormDerived(form, medicine)

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

  return (
    <>
      <Section title="Medicamento">
        <MedicineSelectorRow
          medicine={medicine}
          onPress={onOpenMedicineSheet}
          error={form.touched.medicine_id ? form.errors.medicine_id : null}
        />
      </Section>

      <Section title="Informações do tratamento">
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
        <DoseSection
          isLiquid={isLiquid}
          doseDisplay={doseDisplay}
          intakeOptions={intakeOptions}
          defaultIntake={defaultIntake}
          helperText={helperText}
          askDensity={askDensity}
          densityLabel={densityLabel}
          densityHint={densityHint}
          defaultDensity={defaultDensity}
          onDoseChange={onDoseChange}
          form={form}
        />
      </Section>

      <FrequencySection form={form} showWeekdays={showWeekdays} />

      {/* T018 — entrada opcional da Evolução do tratamento. Toca → salva o tratamento e abre o
          cadastro da escada (create-on-transition). Quem ignora salva igual (US3.2). */}
      {onOpenTitration ? (
        <Section title="Evolução do tratamento">
          <View style={styles.evoBlock}>
            <Pressable
              onPress={onOpenTitration}
              style={({ pressed }) => [styles.evoRow, pressed && styles.evoRowPressed]}
              accessibilityRole="button"
              accessibilityLabel="A dose muda ao longo do tempo? Cadastrar a evolução do tratamento"
            >
              <View style={styles.evoIcon}>
                <ArrowDownNarrowWide size={20} color={colors.primary[600]} strokeWidth={2.4} />
              </View>
              <View style={styles.evoText}>
                <Text style={styles.evoTitle}>
                  {titrationStepCount > 0 ? 'Evolução do tratamento' : 'A dose muda ao longo do tempo?'}
                </Text>
                <Text style={styles.evoHint}>
                  {titrationStepCount > 0
                    ? `${titrationStepCount} ${titrationStepCount === 1 ? 'etapa cadastrada' : 'etapas cadastradas'} · toque para ver`
                    : 'Nenhuma etapa cadastrada · opcional'}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.text.muted} />
            </Pressable>
            {/* Só faz sentido no cadastro (na edição o tratamento já existe). */}
            {!isEditMode ? (
              <Text style={styles.evoFootnote}>
                Você pode cadastrar as etapas agora ou depois, editando o tratamento.
              </Text>
            ) : null}
          </View>
        </Section>
      ) : null}

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

      <PrescriptionSection
        startDateAsDate={startDateAsDate}
        endDateAsDate={endDateAsDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        form={form}
      />

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

      <GuideModal
        visible={guideVisible}
        guideMsg={guideMsg}
        onClose={() => setGuideVisible(false)}
      />
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
  doseRow: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  doseField: {
    flex: 2,
  },
  unitField: {
    flex: 1,
  },
  doseHint: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: -spacing[1],
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
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  evoBlock: { gap: spacing[2] },
  evoRowPressed: { opacity: 0.85 },
  evoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  evoText: { flex: 1, gap: 2 },
  evoTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  evoHint: { fontSize: 12, color: colors.text.muted },
  evoFootnote: { fontSize: 12, color: colors.text.muted, paddingHorizontal: spacing[1], lineHeight: 17 },
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
