import { useMemo, useCallback, useState, useEffect } from 'react'
import { View, Text, Switch, Alert, Linking, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native'
// ⚠️ Namespace + cast NÃO é desleixo — é contorno de resolução de tipos quebrada, e trocar por
// import nomeado QUEBRA o gate cross-program (verificado em 2026-07-20):
//   `lucide-react-native` está hoisted em /node_modules, mas `react-native-svg` só existe em
//   apps/mobile/node_modules. O .d.ts do lucide faz `import { SvgProps } from 'react-native-svg'`
//   e resolve a partir da raiz ⇒ não acha ⇒ tsc trata o módulo como SEM exports. Até `ChevronRight`
//   passa a "não existir".
// Custo aceito: nome de ícone errado vira `undefined` e só quebra no render. Mitigação = manter a
// lista curta e conferir cada nome contra `node_modules/lucide-react-native/dist/icons.d.ts`.
import * as LucideIcons from 'lucide-react-native'

// Conferidos no d.ts do pacote (1703 ícones): `CircleQuestionMark` é o nome ATUAL — `CircleHelp` e
// `HelpCircle` NÃO existem nesta versão, apesar de serem os nomes históricos.
const { ArrowDownNarrowWide, ChevronRight, CircleQuestionMark } = LucideIcons as any
import {
  parseLocalDate,
  formatDoseHint,
  INTAKE_UNIT_LABELS,
  resolveCurrentStep,
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

/** Teto de bolas renderizadas — acima disso vira "+N" (escada longa não pode estourar a linha). */
const EVO_DOTS_MAX = 8

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
  const densityLabel = form.values.intake_unit === 'UI' ? '💧 Densidade: UI por mL' : '💧 Densidade: Gotas por mL'
  const densityHint =
    form.values.intake_unit === 'UI' ? 'Geralmente 100 UI por mL' : 'Geralmente 20 gotas por mL'
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

/**
 * Bolas de progresso da escada — a metade de baixo do card da Evolução.
 *
 * O card era uma linha de 48px ao lado do seletor de horários, que é alto e visualmente pesado:
 * num scan da tela a entrada da titulação simplesmente não era vista (achado de smoke do PO). As
 * bolas dão altura e informação — quantas etapas existem e onde o tratamento está — em vez de só
 * ocupar espaço.
 *
 * A classificação ESPELHA a `TitrationTimeline` de propósito: mesma escada, duas telas, um só
 * significado. Em especial, a vigente vem de `resolveCurrentStep` e NUNCA de `findIndex(status
 * === 'current')` — o banco não impede um resíduo `current` numa posição anterior, e o findIndex
 * pegaria o resíduo, marcando a bola errada em silêncio (achado do RC6 na 029 F4).
 *
 * @private
 */
function EvoStepDots({ steps }) {
  const ordered = Array.isArray(steps) ? [...steps].sort((a, b) => a.position - b.position) : []

  // Empty state: nada cadastrado ainda. Duas interrogações comunicam "isto é uma pergunta que
  // você ainda não respondeu" — em vez de bolas vazias, que sugeririam etapas já existentes.
  if (ordered.length === 0) {
    return (
      <View style={styles.evoDotsRow} accessibilityLabel="Nenhuma etapa cadastrada">
        <CircleQuestionMark size={22} color={colors.neutral[400]} strokeWidth={2} />
        <CircleQuestionMark size={22} color={colors.neutral[400]} strokeWidth={2} />
      </View>
    )
  }

  const currentStep = resolveCurrentStep(ordered)
  const currentIndex = currentStep ? ordered.findIndex((s) => s.id === currentStep.id) : -1

  // A janela acompanha a etapa vigente. Cortar sempre as 8 PRIMEIRAS deixava a vigente de fora em
  // escadas longas (GLP-1 chega a 11 etapas): nenhuma bola marcada, enquanto o accessibilityLabel
  // seguia anunciando "Etapa 9 de 11" — visual e texto discordando em silêncio (RC6 #763).
  const windowStart =
    currentIndex === -1
      ? 0
      : Math.min(
          Math.max(0, currentIndex - Math.floor(EVO_DOTS_MAX / 2)),
          Math.max(0, ordered.length - EVO_DOTS_MAX)
        )
  const shown = ordered.slice(windowStart, windowStart + EVO_DOTS_MAX)
  const hiddenBefore = windowStart
  const hiddenAfter = ordered.length - (windowStart + shown.length)

  return (
    <View
      style={styles.evoDotsRow}
      accessibilityLabel={
        currentIndex !== -1
          ? `Etapa ${currentIndex + 1} de ${ordered.length}`
          : `${ordered.length} etapas cadastradas`
      }
    >
      {hiddenBefore > 0 ? <Text style={styles.evoDotsOverflow}>+{hiddenBefore}</Text> : null}
      {shown.map((s) => {
        // Comparação por `id`, não por índice: o índice é relativo à janela e a vigente é absoluta —
        // foi exatamente esse descasamento que apagou a bola atual.
        if (currentStep && s.id === currentStep.id) {
          return (
            <View key={s.id} testID={`evo-dot-current-${s.id}`} style={[styles.evoDot, styles.evoDotCurrent]}>
              <View style={styles.evoDotCurrentInner} />
            </View>
          )
        }
        if (s.status === 'completed') return <View key={s.id} style={[styles.evoDot, styles.evoDotPast]} />
        return <View key={s.id} style={[styles.evoDot, styles.evoDotFuture]} />
      })}
      {hiddenAfter > 0 ? <Text style={styles.evoDotsOverflow}>+{hiddenAfter}</Text> : null}
    </View>
  )
}

function TitrationSection({
  onOpenTitration,
  titrationStepCount,
  titrationSteps,
  isEditMode,
}: {
  onOpenTitration: () => void
  titrationStepCount: number
  titrationSteps: any[]
  isEditMode: boolean
}) {
  return (
    <Section title="Evolução do tratamento">
      <View style={styles.evoBlock}>
        <Pressable
          onPress={onOpenTitration}
          style={({ pressed }) => [styles.evoCard, pressed && styles.evoRowPressed]}
          accessibilityRole="button"
          accessibilityLabel="A dose muda ao longo do tempo? Cadastrar a evolução do tratamento"
        >
          <View style={styles.evoRow}>
            <View style={styles.evoIcon}>
              <ArrowDownNarrowWide size={22} color={colors.primary[600]} strokeWidth={2.4} />
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
          </View>
          <View style={styles.evoDivider} />
          <EvoStepDots steps={titrationSteps} />
        </Pressable>
        {!isEditMode ? (
          <Text style={styles.evoFootnote}>
            Você pode cadastrar as etapas agora ou depois, editando o tratamento.
          </Text>
        ) : null}
      </View>
    </Section>
  )
}

function CriticalAlarmSection({
  criticalAlarm,
  onToggle,
}: {
  criticalAlarm: boolean
  onToggle: (value: boolean) => void
}) {
  return (
    <Section title="Alertas Críticos">
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleHint}>
            O alarme tocará mesmo no silencioso. Use para doses que não podem ser esquecidas.
          </Text>
        </View>
        <Switch
          value={criticalAlarm}
          onValueChange={onToggle}
          trackColor={{ false: colors.border?.default, true: colors.brand.primary }}
          thumbColor={criticalAlarm ? colors.bg.card : colors.text?.secondary}
          accessibilityLabel="Alerta crítico"
        />
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
  titrationSteps = [],
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

      {onOpenTitration ? (
        <TitrationSection
          onOpenTitration={onOpenTitration}
          titrationStepCount={titrationStepCount}
          titrationSteps={titrationSteps}
          isEditMode={isEditMode}
        />
      ) : null}

      <CriticalAlarmSection
        criticalAlarm={!!form.values.critical_alarm}
        onToggle={handleCriticalAlarmToggle}
      />

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
  // Card com duas metades (topo = chamada, base = progresso da escada). O peso visual é
  // deliberado: ao lado do seletor de horários — alto e denso — a versão de uma linha só
  // desaparecia num scan da tela, e ninguém descobria a titulação (smoke do PO, 2026-07-20).
  evoCard: {
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.bg.card,
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
  },
  evoDivider: { height: 1, backgroundColor: colors.border.default, opacity: 0.6 },
  evoDotsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 26 },
  // Espelham a rail da TitrationTimeline (mesma escada, mesmo significado) em escala menor.
  evoDot: { width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  evoDotPast: { backgroundColor: colors.primary[100] }, // teal soft — concluída
  evoDotCurrent: { backgroundColor: colors.primary[600] }, // vigente
  evoDotCurrentInner: { width: 7, height: 7, borderRadius: 999, backgroundColor: colors.bg.card },
  evoDotFuture: { backgroundColor: colors.bg.card, borderWidth: 2, borderColor: colors.neutral[300] },
  evoDotsOverflow: { fontSize: 12, fontWeight: '600', color: colors.text.muted, marginLeft: 2 },
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
    backgroundColor: colors.bg.overlay,
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
