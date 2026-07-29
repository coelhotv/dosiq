// TitrationFormScreen.tsx — cadastro E edição da Evolução do tratamento (escada, spec 029 F4 / T019).
// Mock: titration-screens.jsx › EvoFormScreen. Abre a partir do form de tratamento (T018), SEMPRE
// com um protocolo já salvo — a etapa 0 precisa do protocol.id (ativação T019a + vínculo A5).
//
// Dois modos (auto-detectados pela existência de escada):
//   • CADASTRO (LadderCreator): escada vazia → builder + [Salvar] via createFullLadder (etapa 0
//     nasce current + started_at — AP-301).
//   • EDIÇÃO (LadderEditor): escada existente → etapas concluídas/vigente read-only (histórico,
//     §4.3), etapas futuras (upcoming) editáveis/removíveis + adicionar nova. [Salvar] reconcilia
//     SÓ o futuro via buildLadderEditPlan/saveLadderEdit (a vigente nunca é tocada — plan A4:247).
//
// Modelo "Gravar etapa" (§4.2, sem auto-save): builder grava uma etapa por vez em card-resumo.

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform, type LayoutChangeEvent } from 'react-native'
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'

import * as LucideIcons from 'lucide-react-native'
import { formatIntakeDose, parseISO, addDays, resolveCurrentStep } from '@dosiq/core'
import ScreenContainer from '@shared/components/ui/ScreenContainer'
import FormActions from '@shared/components/form/FormActions'
import LoadingState from '@shared/components/states/LoadingState'
import { useToast } from '@shared/components/feedback/Toast'
import { lightTap } from '@shared/utils/haptics'
import { colors, spacing, typography, borderRadius } from '@shared/styles/tokens'
import MedicineSelectorSheet from '@treatments/components/MedicineSelectorSheet'
import TitrationStepBuilder from '@treatments/components/TitrationStepBuilder'
import { useTitrationForm, type LadderStep } from '@treatments/hooks/useTitrationForm'
import { useTitrationTimeline } from '@treatments/hooks/useTitrationTimeline'
import {
  createFullLadder,
  buildLadderEditPlan,
  saveLadderEdit,
  isEmptyEditPlan,
  type LadderStepInput,
  type LadderStepWithMedicine,
  type ExistingLadderStep,
  type DesiredEditableStep,
} from '@treatments/services/titrationService'
import { ROUTES } from '@navigation/routes'

const { ArrowLeft, Edit3, Trash2, Clock, Lock } = LucideIcons as any

const FROZEN_STATUS = new Set(['current', 'completed'])
const DAYS_PER_WEEK = 7
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmtDay(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`
}

function weeksLabel(durationDays: number | null): string {
  if (durationDays === null) return 'Contínua'
  const weeks = durationDays / DAYS_PER_WEEK
  const rounded = Number.isInteger(weeks) ? weeks : Math.round(weeks * 10) / 10
  return `${String(rounded).replace('.', ',')} ${rounded === 1 ? 'semana' : 'semanas'}`
}

export default function TitrationFormScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const protocolId: string = route.params?.protocolId
  const seedMedicine = route.params?.medicine ?? null
  const seedDose = route.params?.currentDose ?? null
  const treatmentPlanId: string | null = route.params?.treatmentPlanId ?? null

  const goBack = useCallback(() => {
    lightTap()
    navigation.goBack()
  }, [navigation])

  // Carrega a escada JÁ cadastrada (se houver) para decidir cadastro vs edição.
  const { steps: existingLadder, loading: ladderLoading } = useTitrationTimeline(protocolId)
  const hasExistingLadder = existingLadder.length > 0

  return (
    <ScreenContainer>
      <View style={styles.appbar}>
        <Pressable onPress={goBack} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.appbarTitle}>Evolução do tratamento</Text>
        <View style={styles.appbarSpacer} />
      </View>

      {ladderLoading ? (
        <LoadingState message="Carregando evolução…" />
      ) : hasExistingLadder ? (
        <LadderEditor ladder={existingLadder} protocolId={protocolId} protocolMedicine={seedMedicine} onBack={goBack} />
      ) : (
        <LadderCreator
          protocolId={protocolId}
          protocolMedicine={seedMedicine}
          seedDose={seedDose}
          treatmentPlanId={treatmentPlanId}
          onBack={goBack}
        />
      )}
    </ScreenContainer>
  )
}

// ─── Cadastro (escada vazia) ──────────────────────────────────────────────────
function LadderCreator({
  protocolId,
  protocolMedicine,
  seedDose,
  treatmentPlanId,
  onBack,
}: {
  protocolId: string
  protocolMedicine: any
  seedDose: number | string | null
  treatmentPlanId: string | null
  onBack: () => void
}) {
  const navigation = useNavigation<any>()
  const { show } = useToast()
  const [saving, setSaving] = useState(false)
  const form = useTitrationForm({ seedMedicine: protocolMedicine, seedDose })

  const handleSave = useCallback(async () => {
    // Etapa no builder mas não gravada NÃO se perde em silêncio (Const. IX).
    if (form.builder.medicine && form.builder.doseRaw.trim() !== '') {
      show('Toque em "Gravar etapa" antes de salvar.', { variant: 'error' })
      return
    }
    if (form.steps.length === 0) {
      show('Cadastre ao menos uma etapa.', { variant: 'error' })
      return
    }
    if (!protocolMedicine?.id) {
      show('Medicamento do tratamento indisponível. Volte e tente de novo.', { variant: 'error' })
      return
    }
    const payload: LadderStepInput[] = form.steps.map((s) => ({
      medicine_id: s.medicine.id,
      dose: s.dose,
      intake_unit: s.intakeUnit,
      duration_days: s.durationDays,
    }))
    setSaving(true)
    try {
      await createFullLadder(protocolId, protocolMedicine.id, payload, treatmentPlanId)
      show('Evolução do tratamento salva.', { variant: 'success' })
      navigation.goBack()
    } catch (err: any) {
      show(err?.message ?? 'Erro ao salvar a evolução do tratamento.', { variant: 'error' })
      setSaving(false)
    }
  }, [form, protocolId, protocolMedicine, treatmentPlanId, navigation, show])

  const header = (
    <Text style={styles.intro}>
      Cadastre as etapas como estão na prescrição — o Dosiq executa a sequência e te lembra quando
      mudar.
    </Text>
  )

  return (
    <LadderStepsEditor
      form={form}
      header={header}
      stepOffset={0}
      primaryLabel="Salvar"
      onPrimary={handleSave}
      saving={saving}
      onBack={onBack}
    />
  )
}

// ─── Edição (escada existente) ────────────────────────────────────────────────
function LadderEditor({
  ladder,
  protocolId,
  protocolMedicine,
  onBack,
}: {
  ladder: LadderStepWithMedicine[]
  protocolId: string
  protocolMedicine: any
  onBack: () => void
}) {
  const navigation = useNavigation<any>()
  const { show } = useToast()
  const [saving, setSaving] = useState(false)

  const ordered = useMemo(() => [...ladder].sort((a, b) => a.position - b.position), [ladder])
  const frozen = useMemo(() => ordered.filter((s) => FROZEN_STATUS.has(s.status)), [ordered])
  const editableExisting = useMemo(() => ordered.filter((s) => !FROZEN_STATUS.has(s.status)), [ordered])
  const titrationId = ordered[0]?.titration_id ?? ''
  const hasCompleted = frozen.some((s) => s.status === 'completed')

  const initialSteps = useMemo<LadderStep[]>(
    () =>
      editableExisting.map((s) => ({
        id: s.id,
        medicine: s.medicine,
        dose: s.dose,
        intakeUnit: s.intake_unit,
        durationDays: s.duration_days,
      })),
    [editableExisting],
  )

  const form = useTitrationForm({ seedMedicine: null, seedDose: null, initialSteps })

  // Data de vigência das alterações = início projetado da 1ª etapa futura (fim da vigente).
  //
  // 🔴 `resolveCurrentStep`, nunca `find(s => s.status === 'current')` (achado do RC6). O banco
  // não impede duas etapas `current` na mesma escada, e aqui a escolha não é só cosmética:
  // `currentIsContinua` alimenta `firstNewStepPending`, que decide se a etapa nova é PERSISTIDA
  // como `pending_confirmation` ou `upcoming`. Com um resíduo na posição 0, a etapa nasceria com
  // o status errado — inalcançável (`upcoming` atrás de uma contínua) ou pendente indevida.
  const currentStep = resolveCurrentStep(frozen)
  const currentIsContinua = currentStep != null && currentStep.duration_days == null
  const effectiveDate = useMemo(() => {
    if (currentStep?.started_at && currentStep.duration_days) {
      return addDays(parseISO(currentStep.started_at), currentStep.duration_days)
    }
    return null
  }, [currentStep])

  const handleSave = useCallback(async () => {
    if (form.builder.medicine && form.builder.doseRaw.trim() !== '') {
      show('Toque em "Gravar etapa" antes de salvar.', { variant: 'error' })
      return
    }
    if (!protocolMedicine?.id || !titrationId) {
      show('Escada indisponível. Volte e tente de novo.', { variant: 'error' })
      return
    }
    const existing: ExistingLadderStep[] = ordered.map((s) => ({
      id: s.id,
      position: s.position,
      status: s.status,
      medicine_id: s.medicine_id,
      dose: s.dose,
      intake_unit: s.intake_unit,
      duration_days: s.duration_days,
      protocol_id: s.protocol_id,
    }))
    const desired: DesiredEditableStep[] = form.steps.map((s) => ({
      id: s.id,
      medicine_id: s.medicine.id,
      dose: s.dose,
      intake_unit: s.intakeUnit,
      duration_days: s.durationDays,
    }))
    // F5.5: vigente contínua → a 1ª etapa criada nasce `pending_confirmation` (gatilho manual —
    // Decisões §7.4). Com vigente FINITA nada muda: quem marca a pendência é o motor, no
    // vencimento.
    const plan = buildLadderEditPlan(
      titrationId,
      protocolId,
      protocolMedicine.id,
      existing,
      desired,
      currentIsContinua,
    )
    if (isEmptyEditPlan(plan)) {
      navigation.goBack()
      return
    }
    setSaving(true)
    try {
      await saveLadderEdit(plan)
      show('Evolução do tratamento atualizada.', { variant: 'success' })
      navigation.goBack()
    } catch (err: any) {
      show(err?.message ?? 'Erro ao salvar a evolução do tratamento.', { variant: 'error' })
      setSaving(false)
    }
  }, [form, ordered, titrationId, protocolId, protocolMedicine, currentIsContinua, navigation, show])

  const header = (
    <>
      {/* Ordem de leitura (smoke do PO, 2026-07-19): o que a tela FAZ → a limitação → as etapas
          congeladas → a vigência das alterações. A limitação aparecia DUAS vezes (aqui e no box do
          cadeado, separados pelos cards), e o box explicava cards que o usuário já tinha passado.
          Uma vez só, e ANTES do que ela descreve. */}
      <Text style={styles.intro}>Edite ou adicione as próximas etapas da evolução.</Text>

      {/* Gate = `frozen.length > 0`, não `hasCompleted`: a etapa EM CURSO também é congelada
          (`FROZEN_STATUS`), então uma escada com a 1ª etapa rodando e nenhuma concluída ficava
          sem explicação nenhuma para os cards read-only logo abaixo. */}
      {frozen.length > 0 ? (
        <View style={styles.lockNote}>
          <Lock size={14} color={colors.text.secondary} strokeWidth={2} />
          <Text style={styles.lockNoteText}>
            {hasCompleted
              ? 'As etapas concluídas e a etapa em curso fazem parte do histórico de doses e não podem ser alteradas.'
              : 'A etapa em curso faz parte do histórico de doses e não pode ser alterada.'}
          </Text>
        </View>
      ) : null}

      {frozen.map((s, i) => (
        <FrozenStepCard key={s.id} step={s} n={i + 1} />
      ))}

      {/* Só a DATA de vigência. O "Nada muda na etapa vigente" saiu no smoke do PO: o box do
          cadeado, agora logo acima, já diz que a etapa em curso não pode ser alterada — a mesma
          conclusão em outras palavras, a duas linhas de distância. */}
      <View style={styles.editBanner}>
        <Text style={styles.editBannerText}>
          As alterações valem{' '}
          <Text style={styles.editBannerStrong}>
            {effectiveDate ? `a partir de ${fmtDay(effectiveDate)}` : 'a partir da próxima etapa'}
          </Text>
          .
        </Text>
      </View>
    </>
  )

  return (
    <LadderStepsEditor
      form={form}
      header={header}
      stepOffset={frozen.length}
      primaryLabel="Salvar alterações"
      onPrimary={handleSave}
      saving={saving}
      onBack={onBack}
      terminalWhenEmpty={currentIsContinua}
    />
  )
}

// Scroll até o builder ao editar uma etapa (sem isso o form abre fora da viewport — a lista de
// etapas empurra o builder pra baixo e a edição parece "não ter acontecido").
function useScrollToBuilder() {
  const scrollRef = useRef<ScrollView>(null)
  const builderYRef = useRef(0)
  const onBuilderLayout = useCallback((e: LayoutChangeEvent) => {
    builderYRef.current = e.nativeEvent.layout.y
  }, [])
  const scrollToBuilder = useCallback(() => {
    // Dois frames: 1º deixa o builder (re)renderizar/relayoutar, 2º garante o y atualizado.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ y: Math.max(0, builderYRef.current - 16), animated: true }),
      ),
    )
  }, [])
  return { scrollRef, onBuilderLayout, scrollToBuilder }
}

// ─── Região compartilhada: cards editáveis + builder + sheet ──────────────────
function LadderStepsEditor({
  form,
  header,
  stepOffset,
  primaryLabel,
  onPrimary,
  saving,
  onBack,
  terminalWhenEmpty = false,
}: {
  form: ReturnType<typeof useTitrationForm>
  header: ReactNode
  stepOffset: number
  primaryLabel: string
  onPrimary: () => void
  saving: boolean
  onBack: () => void
  // Edição: a etapa vigente é contínua (terminal) e não há etapas futuras → a escada já encerrou,
  // não se oferece adicionar (uma etapa depois de uma contínua nunca rodaria).
  terminalWhenEmpty?: boolean
}) {
  const navigation = useNavigation<any>()
  const {
    steps,
    builder,
    editingIndex,
    doseSuffix,
    canDuplicate,
    sheetOpen,
    setSheetOpen,
    pendingReopenSheet,
    setPendingReopenSheet,
    error,
    selectMedicine,
    setDoseRaw,
    setDurationWeeksRaw,
    toggleContinua,
    duplicatePrevious,
    commitStep,
    editStep,
    removeStep,
    cancelEdit,
  } = form

  // F5.5 — o builder só abre NO TOQUE (`[+ Adicionar etapa]`). Deixá-lo sempre aberto sugeriria a
  // todo paciente em manutenção que a escada está incompleta — convite a cadastrar etapa sem
  // indicação médica (SaMD, ADR-062). Cadastrar é ato deliberado, não default da tela.
  const [manualAddOpen, setManualAddOpen] = useState(false)

  // Refs/scroll (R-010: antes de effects/handlers).
  const { scrollRef, onBuilderLayout, scrollToBuilder } = useScrollToBuilder()

  // Reabrir sheet ao voltar de MedicineFormScreen (cadastro na hora).
  useFocusEffect(
    useCallback(() => {
      if (pendingReopenSheet) {
        setPendingReopenSheet(false)
        setSheetOpen(true)
      }
    }, [pendingReopenSheet, setPendingReopenSheet, setSheetOpen]),
  )

  const handleCreateNewMedicine = useCallback(() => {
    setPendingReopenSheet(true)
    navigation.navigate(ROUTES.MEDICINE_CREATE)
  }, [navigation, setPendingReopenSheet])

  // Scroll até o builder ao editar uma etapa: sem isso o form abre fora da viewport (a lista de
  // etapas empurra o builder pra baixo) e a edição parece "não ter acontecido".
  const handleEdit = useCallback(
    (index: number) => {
      editStep(index)
      scrollToBuilder()
    },
    [editStep, scrollToBuilder],
  )

  const onAddManualStep = useCallback(() => {
    lightTap()
    setManualAddOpen(true)
    scrollToBuilder()
  }, [scrollToBuilder])

  const builderLabel =
    editingIndex !== null
      ? `Editando etapa ${editingIndex + 1 + stepOffset}`
      : `Nova etapa · ${steps.length + 1 + stepOffset}`

  // Etapa contínua encerra a escada (terminal). Uma vez gravada como última, o app não oferece
  // nova etapa; para inserir algo antes dela, o usuário edita/remove a contínua.
  const lastIsContinua = steps.length > 0 && steps[steps.length - 1].durationDays === null
  const terminalEmpty = steps.length === 0 && terminalWhenEmpty && !manualAddOpen
  const showBuilder = editingIndex !== null || (!lastIsContinua && !terminalEmpty)

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {header}

          {steps.map((step, index) => (
            <StepSummaryCard
              key={step.id ?? `new-${index}`}
              n={index + 1 + stepOffset}
              step={step}
              editing={editingIndex === index}
              onEdit={() => handleEdit(index)}
              onRemove={() => removeStep(index)}
            />
          ))}

          {steps.length >= 2 ? (
            <View style={styles.previstoRow}>
              <Clock size={16} color={colors.text.secondary} strokeWidth={2} />
              <Text style={styles.previstoText}>
                Tempo previsto: <Text style={styles.previstoStrong}>{totalWeeksLabel(steps)}</Text> até
                a etapa contínua.
              </Text>
            </View>
          ) : null}

          {showBuilder ? (
            <View onLayout={onBuilderLayout}>
            <TitrationStepBuilder
              positionLabel={builderLabel}
              medicine={builder.medicine}
              doseRaw={builder.doseRaw}
              durationWeeksRaw={builder.durationWeeksRaw}
              continua={builder.continua}
              doseSuffix={doseSuffix}
              canDuplicate={canDuplicate}
              error={error}
              onOpenMedicineSheet={() => setSheetOpen(true)}
              onDoseChange={setDoseRaw}
              onDurationChange={setDurationWeeksRaw}
              onToggleContinua={toggleContinua}
              onDuplicate={duplicatePrevious}
              onCommit={commitStep}
            />
            </View>
          ) : terminalEmpty ? (
            // F5.5 — a escada NÃO chegou ao fim, chegou à MANUTENÇÃO. O texto anterior ("a
            // evolução já chegou ao fim. Não há próximas etapas a cadastrar") era um beco: o
            // paciente em manutenção cujo médico sobe a dose não tinha porta nenhuma no app.
            <View style={styles.terminalBlock}>
              <Text style={styles.closedNote}>
                A etapa contínua vale até seu médico mudar a prescrição.
              </Text>
              <Pressable
                onPress={onAddManualStep}
                style={({ pressed }) => [styles.addStepBtn, pressed && styles.addStepBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Adicionar etapa"
              >
                <Text style={styles.addStepText}>+ Adicionar etapa</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.closedNote}>
              A <Text style={styles.previstoStrong}>etapa contínua</Text> encerra a evolução. Para inserir outra etapa, edite ou remova
              a última etapa.
            </Text>
          )}

          {editingIndex !== null ? (
            <Pressable onPress={cancelEdit} style={styles.cancelEditBtn} accessibilityRole="button">
              <Text style={styles.cancelEditText}>Cancelar edição da etapa</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <FormActions
          primaryLabel={primaryLabel}
          onPrimary={onPrimary}
          primaryLoading={saving}
          secondaryLabel="Cancelar"
          onSecondary={onBack}
        />
      </KeyboardAvoidingView>

      <MedicineSelectorSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={selectMedicine}
        onCreateNew={handleCreateNewMedicine}
        selectedId={builder.medicine?.id}
      />
    </>
  )
}

function totalWeeksLabel(steps: LadderStep[]): string {
  const totalDays = steps.reduce((acc, s) => acc + (s.durationDays ?? 0), 0)
  return weeksLabel(totalDays)
}

// Etapa congelada (concluída/vigente) — read-only. Concluída = cadeado; vigente = tag "Em curso".
function FrozenStepCard({ step, n }: { step: LadderStepWithMedicine; n: number }) {
  const isCompleted = step.status === 'completed'
  const doseLabel = formatIntakeDose(step.dose, step.intake_unit, step.medicine)
  return (
    <View
      style={[styles.summaryCard, styles.frozenCard]}
      accessible
      accessibilityLabel={`Etapa ${n}, ${isCompleted ? 'concluída, somente leitura' : 'vigente'}, ${step.medicine?.name}, ${doseLabel}`}
    >
      <Text style={[styles.summaryBadge, styles.frozenBadge]}>Etapa {n}</Text>
      <View style={styles.summaryBody}>
        <Text style={styles.summaryTitle}>
          {step.medicine?.name} · {doseLabel}
        </Text>
        <Text style={styles.summaryDuration}>
          {weeksLabel(step.duration_days)} · {isCompleted ? 'Concluída' : 'Vigente'}
        </Text>
      </View>
      {isCompleted ? (
        <Lock size={16} color={colors.text.secondary} strokeWidth={2} />
      ) : (
        <View style={styles.currentTag}>
          <Text style={styles.currentTagText}>Em curso</Text>
        </View>
      )}
    </View>
  )
}

function StepSummaryCard({
  n,
  step,
  editing,
  onEdit,
  onRemove,
}: {
  n: number
  step: LadderStep
  editing: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const doseLabel = formatIntakeDose(step.dose, step.intakeUnit, step.medicine)
  return (
    <View style={[styles.summaryCard, editing && styles.summaryCardEditing]}>
      <Text style={styles.summaryBadge}>Etapa {n}</Text>
      <View style={styles.summaryBody}>
        <Text style={styles.summaryTitle}>
          {step.medicine?.name} · {doseLabel}
        </Text>
        <Text style={styles.summaryDuration}>{weeksLabel(step.durationDays)}</Text>
      </View>
      <View style={styles.summaryActions}>
        <Pressable onPress={onEdit} style={styles.summaryIconBtn} accessibilityRole="button" accessibilityLabel={`Editar etapa ${n}`} hitSlop={8}>
          <Edit3 size={17} color={colors.text.secondary} />
        </Pressable>
        <Pressable onPress={onRemove} style={styles.summaryIconBtn} accessibilityRole="button" accessibilityLabel={`Excluir etapa ${n}`} hitSlop={8}>
          <Trash2 size={17} color={colors.text.secondary} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  appbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  iconBtn: { padding: spacing[1] },
  appbarTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  appbarSpacer: { width: 32 },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  intro: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.bg.card,
  },
  summaryCardEditing: {
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
  frozenCard: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
  },
  summaryBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.primary[700],
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  frozenBadge: {
    color: colors.text.secondary,
    backgroundColor: colors.neutral[100],
  },
  summaryBody: { flex: 1, gap: 2 },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  summaryDuration: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  summaryActions: { flexDirection: 'row', gap: 2 },
  summaryIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  currentTag: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primary[100],
  },
  currentTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[1],
  },
  lockNoteText: { flex: 1, fontSize: 12, color: colors.text.secondary, lineHeight: 17 },
  editBanner: {
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  editBannerText: { fontSize: 13, color: colors.text.secondary, lineHeight: 19 },
  editBannerStrong: { fontWeight: '800', color: colors.text.primary },
  previstoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.bg.card,
  },
  previstoText: { flex: 1, fontSize: 13, color: colors.text.secondary },
  previstoStrong: { fontWeight: '800', color: colors.text.primary },
  closedNote: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  // F5.5 — bloco terminal: a copy da manutenção + a porta de saída.
  terminalBlock: { gap: spacing[1] },
  addStepBtn: {
    minHeight: 48,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[1],
  },
  addStepBtnPressed: { opacity: 0.85 },
  addStepText: { fontSize: 14, fontWeight: '700', color: colors.primary[600] },
  cancelEditBtn: { alignItems: 'center', paddingVertical: spacing[2] },
  cancelEditText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
})
