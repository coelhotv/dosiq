// MedicineFormScreen.jsx — tela unificada create + edit (Sprint M1.2)
//
// Recebe `medicine` em route.params para modo edição. Sem param = modo criação.
// ANVISA bottom sheet preenche campos automaticamente via setValues.

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, ScanBarcode, ChevronRight } = LucideIcons as any
import {
  medicineCreateSchema,
  MEDICINE_TYPES,
  MEDICINE_TYPE_LABELS,
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  PRESENTATIONS,
  PRESENTATION_LABELS,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
  normalizeRegulatoryCategory,
  labelAmount,
  isLiquidDosageUnit,
  type CmedStrengthChoice,
} from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormSection from '@shared/components/form/FormSection'
import FormActions from '@shared/components/form/FormActions'
import { useMedicineMutation } from '@medications/hooks/useMedicineMutation'
import { AnvisaBanner } from '@medications/components/AnvisaBanner'
import { MedicineAnvisaSheet } from '@medications/components/MedicineAnvisaSheet'
import { MedicineCandidatesSheet } from '@medications/scan/MedicineCandidatesSheet'
import { StrengthChoiceCard } from '@medications/components/StrengthChoiceCard'
import { ConcentrationVolumeField } from '@medications/components/ConcentrationVolumeField'
import {
  valuesFromDraft,
  draftExtras,
  baseFromScan,
  scanDoseEdited,
  normalizeConcentration,
} from '@medications/utils/medicineDraftValues'
import { ROUTES } from '@navigation/routes'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const TYPE_OPTIONS = MEDICINE_TYPES.map((value) => ({
  value,
  label: MEDICINE_TYPE_LABELS[value] ?? value,
}))

const UNIT_OPTIONS = DOSAGE_UNITS.map((value) => ({
  value,
  label: DOSAGE_UNIT_LABELS[value] ?? value,
}))

// Líquido := dosage_unit termina em '/ml' (decisão-mãe 022).
const isLiquidUnit = isLiquidDosageUnit

const PRESENTATION_OPTIONS = PRESENTATIONS.map((value) => ({
  value,
  label: PRESENTATION_LABELS[value] ?? value,
}))

const REGULATORY_OPTIONS = REGULATORY_CATEGORIES.map((value) => ({
  value,
  label: REGULATORY_CATEGORY_LABELS[value] ?? value,
}))

const DEFAULT_INITIAL = { type: 'medicamento', dosage_unit: 'mg' }

// 066 Slice C (T023a): "Ver todas" no fim do dropdown filtrado por `forms` (INV-3).
const ALL_FORMS_VALUE = '__all__'
const PRESENTATION_SET = new Set<string>(PRESENTATIONS)

// `forms` do item da base (manifest ≥ 1.1.11); cache antigo não tem o campo.
function validForms(forms: unknown): string[] {
  if (!Array.isArray(forms)) return []
  return [...new Set(forms.filter((f): f is string => typeof f === 'string' && PRESENTATION_SET.has(f)))]
}

function formProps(form, name) {
  return {
    value: form.values[name],
    error: form.touched[name] ? form.errors[name] : undefined,
    onChange: form.handleChange,
    onBlur: form.handleBlur,
  }
}

// 066 D1: origem do cadastro para o `medicine_added` (TRACKING_PLAN §5.3).
function createSource(scanInfo, anvisaFilledLabel) {
  if (scanInfo) return 'scan'
  return anvisaFilledLabel ? 'anvisa_search' : 'manual'
}

// Nova leitura = novo objeto em `scanDraft` (popTo com merge); a mesma não se reaplica a cada render.
function isNewScan(isEditing, scanDraft, appliedScanDraft) {
  return !isEditing && !!scanDraft && scanDraft !== appliedScanDraft
}

function formTitle(isEditing, scanInfo) {
  if (isEditing) return 'Editar Medicamento'
  return scanInfo ? 'Confira antes de salvar' : 'Novo Medicamento'
}

// FR-017 / D11: o laboratório do genérico é da caixa, não do remédio — exibido, não guardado.
function ScanGenericNote({ scanInfo }) {
  if (!scanInfo?.isGeneric || !scanInfo.displayLaboratory) return null
  return (
    <View style={styles.genericBox}>
      <Text style={styles.genericTitle}>Caixa desta vez: {scanInfo.displayLaboratory}</Text>
      <Text style={styles.genericText}>
        É genérico: de qualquer laboratório, é o mesmo remédio. Por isso o laboratório não fica guardado.
      </Text>
    </View>
  )
}

// eslint-disable-next-line max-lines-per-function
export default function MedicineFormScreen() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const [sheetOpen, setSheetOpen] = useState(false)
  // 066: formas do item escolhido (filtro do dropdown), "Ver todas", edição manual da forma,
  // dose ambígua (INV-2) e força completa da caixa (D9).
  const [itemForms, setItemForms] = useState<string[]>([])
  const [showAllForms, setShowAllForms] = useState(false)
  const [presentationTouched, setPresentationTouched] = useState(false)
  const [doseCheckRequired, setDoseCheckRequired] = useState(false)
  const [strengthLabel, setStrengthLabel] = useState<string | null>(null)
  // C-C10: concentrações de 1 toque do composto ambíguo; erro no campo ao salvar sem escolher.
  const [strengthChoices, setStrengthChoices] = useState<CmedStrengthChoice[]>([])
  const [doseChoiceError, setDoseChoiceError] = useState(false)
  // C5.3: o que veio da busca (card vira selo de origem + "Trocar") e a origem do medicine_added.
  const [anvisaFilledLabel, setAnvisaFilledLabel] = useState<string | null>(null)
  // 066 D1 (RC3 A): o form é a confirmação do código de barras. `scanInfo` = caixa lida aplicada;
  // `candidatesDecided` = a pergunta "É este que você já tem?" já foi respondida (ou não tinha candidato).
  const [scanInfo, setScanInfo] = useState<any>(null)
  const [appliedScanDraft, setAppliedScanDraft] = useState<any>(null)
  const [candidatesDecided, setCandidatesDecided] = useState(false)
  // C-D1-3: posição da seção "Identificação" para a volta "manual" do scanner.
  const scrollRef = useRef<ScrollView>(null)
  const identificationY = useRef(0)
  const medicine = route.params?.medicine ?? null
  const isEditing = !!medicine

  // Memos
  // FormInput espera string. Converter dosage_per_pill (number no DB) para string
  // ao carregar para edição. Outros campos number-like seguem mesma regra.
  const initialValues = useMemo(() => {
    if (!medicine) return DEFAULT_INITIAL
    // FR-031 (ADR-066): o campo exibe o `amount` do rótulo = razão × volume; transforma só
    // quando há denominador salvo (≠ null). Senão exibe a razão crua (volume 1).
    const amountStr =
      medicine.dosage_per_pill !== null && medicine.dosage_per_pill !== undefined
        ? String(labelAmount(medicine.dosage_per_pill, medicine.concentration_volume_ml) ?? medicine.dosage_per_pill)
        : ''
    return {
      ...medicine,
      dosage_per_pill: amountStr,
      concentration_volume_ml:
        medicine.concentration_volume_ml !== null && medicine.concentration_volume_ml !== undefined
          ? String(medicine.concentration_volume_ml)
          : '',
      shelf_life_days:
        medicine.shelf_life_days !== null && medicine.shelf_life_days !== undefined
          ? String(medicine.shelf_life_days)
          : '',
    }
  }, [medicine])

  const presentationOptions = useMemo(() => {
    if (showAllForms || itemForms.length < 2) return PRESENTATION_OPTIONS
    return [
      ...PRESENTATION_OPTIONS.filter((o) => itemForms.includes(o.value)),
      { value: ALL_FORMS_VALUE, label: 'Ver todas' },
    ]
  }, [itemForms, showAllForms])

  // Hooks dependentes (consomem memos acima)
  // Usa createSchema para create + edit — em edit todos obrigatórios continuam exigidos
  // (não pode apagar nome/dose/unidade ao editar).
  const form = useFormState(medicineCreateSchema, { initialValues })
  const { create, update, isLoading } = useMedicineMutation()

  // 066 D1: rascunho devolvido pelo scanner (popTo com `scanDraft`). Aplicado durante o render, uma
  // vez por leitura (nova leitura = novo objeto). Todo campo segue editável (INV-6); nada é gravado aqui.
  const scanDraft = route.params?.scanDraft ?? null
  if (isNewScan(isEditing, scanDraft, appliedScanDraft)) {
    setAppliedScanDraft(scanDraft)
    form.setValues(valuesFromDraft(baseFromScan(scanDraft, form.values), scanDraft, form.values))
    const extras = draftExtras(scanDraft)
    setDoseCheckRequired(extras.doseCheckRequired)
    setStrengthChoices(extras.strengthChoices)
    setStrengthLabel(extras.strengthLabel)
    setDoseChoiceError(false)
    setItemForms([])
    setShowAllForms(false)
    setPresentationTouched(false)
    setAnvisaFilledLabel([scanDraft.name, scanDraft.strengthLabel].filter(Boolean).join(' '))
    setScanInfo(scanDraft)
    setCandidatesDecided(false)
  }

  // Effects
  // "Escanear caixa" da lista abre o form já com o scanner por cima; o form fica embaixo como o
  // caminho manual e a confirmação (RC3 A).
  const startScan = !!route.params?.startScan
  useEffect(() => {
    if (!startScan) return
    navigation.setParams({ startScan: undefined })
    navigation.navigate(ROUTES.MEDICINE_SCAN, { entryPoint: route.params?.scanEntryPoint ?? 'medicines_list' })
  }, [startScan, navigation, route.params?.scanEntryPoint])

  // C-D1-3: desistiu da caixa ("Digitar manualmente"/"Cadastrar digitando") ⇒ pula o card e vai ao form.
  const manualEntry = route.params?.manualEntry
  useEffect(() => {
    if (!manualEntry) return
    scrollRef.current?.scrollTo({ y: identificationY.current, animated: true })
  }, [manualEntry])

  // Handlers
  const openSheet = useCallback(() => setSheetOpen(true), [])
  const handleIdentificationLayout = useCallback((e) => {
    identificationY.current = e.nativeEvent.layout.y
  }, [])
  const openScanner = useCallback(
    () => navigation.navigate(ROUTES.MEDICINE_SCAN, { entryPoint: 'medicine_form' }),
    [navigation]
  )

  // C-D1-2: o "Trocar" abre o sheet, que também oferece o código de barras.
  const openScannerFromSheet = useCallback(() => {
    setSheetOpen(false)
    openScanner()
  }, [openScanner])

  // D-4 "Sim, é este": nada é criado, com estoque ligado ou não (PO 2026-10-16); volta a quem abriu.
  const handleUseExisting = useCallback(
    (existing) => {
      setCandidatesDecided(true)
      logEvent(EVENTS.SCAN_CONFIRMED, { surface: SURFACES.MOBILE, used_existing: true, dose_edited: false })
      Alert.alert('Você já tem este remédio', `Vamos usar "${existing?.name ?? 'o remédio escolhido'}". Nada novo foi criado.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    },
    [navigation]
  )
  const handleCreateNew = useCallback(() => setCandidatesDecided(true), [])
  const handleNoCandidates = useCallback(() => setCandidatesDecided(true), [])
  // ✕ no sheet: sai do cadastro sem gravar nada (INV-1).
  const handleCandidatesClose = useCallback(() => navigation.goBack(), [navigation])
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  // 066 Slice C: o sheet devolve { anvisaItem, cmedDraft? }. Com caixa escolhida no passo 2, o
  // rascunho da CMED prevalece (dose/unidade/forma/registro; laboratório só de não-genérico — D11).
  // Sem caixa: preenche como antes, `forms` sugere a forma e o registro é limpo (C-C4).
  const handleAnvisaSelect = useCallback(
    ({ anvisaItem: item, cmedDraft: draft }) => {
      // Genéricos não trazem laboratório (será preenchido no estoque por compra).
      // Demais categorias: usar laboratory do registro ANVISA.
      const isGeneric = (item.regulatoryCategory ?? '')
        .toLowerCase()
        .startsWith('gener')
      const forms = validForms(item.forms)
      const base = {
        name: item.name ?? form.values.name,
        active_ingredient: item.activeIngredient ?? form.values.active_ingredient,
        therapeutic_class: item.therapeuticClass ?? form.values.therapeutic_class,
        // 100 B (C-B3): busca sem caixa não traz código; zera o de uma caixa escolhida antes (merge).
        therapeutic_class_code: null,
        // Base ANVISA traz a categoria sem acento/normalização ('Biologico'); o Picker
        // (esp. iOS, match estrito) só casa o valor canônico acentuado ('Biológico').
        // normalizeRegulatoryCategory mapeia p/ o enum canônico — mesma correção da web.
        regulatory_category:
          normalizeRegulatoryCategory(item.regulatoryCategory) ?? form.values.regulatory_category,
        laboratory: isGeneric ? '' : (item.laboratory ?? form.values.laboratory ?? ''),
        anvisa_registration: null,
      }
      setAnvisaFilledLabel(
        draft ? [draft.name, draft.strengthLabel].filter(Boolean).join(' ') : (item.name ?? null)
      )
      setItemForms(draft ? [] : forms)
      setShowAllForms(false)
      // Trocar pela busca descarta a caixa lida antes (o form deixa de ser "lido pelo código").
      setScanInfo(null)
      if (draft) {
        form.setValues(valuesFromDraft(base, draft, form.values))
        const extras = draftExtras(draft)
        setDoseCheckRequired(extras.doseCheckRequired)
        setStrengthChoices(extras.strengthChoices)
        setDoseChoiceError(false)
        setStrengthLabel(extras.strengthLabel)
        setPresentationTouched(false)
      } else {
        const presentation = forms.length === 1 && !presentationTouched ? forms[0] : undefined
        form.setValues(presentation ? { ...base, presentation } : base)
        setDoseCheckRequired(false)
        setStrengthChoices([])
        setDoseChoiceError(false)
        setStrengthLabel(null)
      }
      setSheetOpen(false)
    },
    [form, presentationTouched]
  )

  // Normaliza vírgula→ponto em tempo real (PT-BR digita 1,5; JS/Postgres esperam 1.5).
  // Aceita apenas dígitos + um separador decimal único.
  const handleDoseChange = useCallback(
    (name, value) => {
      const cleaned = String(value ?? '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '')
        // colapsa múltiplos pontos no primeiro
        .replace(/^(\d*\.\d*).*$/, '$1')
      // FormInput passa o name; fallback dosage_per_pill p/ chamadas legadas.
      form.handleChange(name || 'dosage_per_pill', cleaned)
    },
    [form]
  )

  // Ao escolher unidade líquida (/ml): marca presentation='liquido'. Densidade NÃO
  // é pedida aqui (022 Fase C — pertence ao tratamento). Sólido → 'comprimido'.
  // NÃO sobrescreve 'injetavel' (012): injeção pode ser /ml mas tem TTL próprio.
  const handleUnitChange = useCallback(
    (_name, value) => {
      form.handleChange('dosage_unit', value)
      const currentPresentation = form.values.presentation
      if (currentPresentation !== 'injetavel') {
        form.handleChange('presentation', isLiquidUnit(value) ? 'liquido' : 'comprimido')
      }
    },
    [form]
  )

  // Ao selecionar 'injetavel': prefill 28 dias (editável) apenas se shelf_life_days vazio.
  // Outras presentations: limpa apenas o prefill 28 — preserva valor digitado manualmente.
  const handlePresentationChange = useCallback(
    (_name, value) => {
      if (value === ALL_FORMS_VALUE) {
        setShowAllForms(true)
        return
      }
      setPresentationTouched(true)
      form.handleChange('presentation', value)
      if (value === 'injetavel') {
        const current = form.values.shelf_life_days
        if (current === '' || current === null || current === undefined) {
          form.handleChange('shelf_life_days', '28')
        }
      } else {
        // Campo fica oculto fora de injetavel — limpar evita persistir valor
        // obsoleto ao salvar (review Gemini #658, mesmo fix do web).
        form.handleChange('shelf_life_days', '')
      }
    },
    [form]
  )

  // Aceita dígitos inteiros positivos; apagar → '' (null no Zod).
  const handleShelfLifeChange = useCallback(
    (_name, value) => {
      const cleaned = String(value ?? '').replace(/[^\d]/g, '')
      form.handleChange('shelf_life_days', cleaned)
    },
    [form]
  )

  const handleSubmit = useCallback(async () => {
    // INV-2 (C-C2): o Zod aceita dose vazia; o composto ambíguo exige a escolha. O botão não muda
    // de rótulo nem trava (C-C10): o erro aparece no campo, como em qualquer obrigatório.
    if (doseCheckRequired && String(form.values.dosage_per_pill ?? '').trim() === '') {
      setDoseChoiceError(true)
      Alert.alert('Verifique o formulário', 'Escolha a concentração do remédio.')
      return
    }
    // FM-7: a pergunta "É este que você já tem?" ainda não teve resposta (lista chegando).
    if (scanInfo && !candidatesDecided) {
      Alert.alert('Um momento', 'Estamos conferindo se você já tem este remédio.')
      return
    }
    if (!form.validate()) {
      // Anti-silent-no-op (smoke iOS 022): nunca falhar sem feedback. Mostra 1º erro.
      // form.errors fica stale neste tick (setErrors async); reparse p/ msg precisa.
      const parsed = medicineCreateSchema.safeParse(form.values)
      const firstError = parsed.success ? null : parsed.error.issues[0]?.message
      Alert.alert(
        'Verifique o formulário',
        firstError || 'Há campos obrigatórios não preenchidos.'
      )
      return
    }
    // FR-031 (ADR-066): normaliza amount→razão. Líquido c/ denominador ≠ 1 → dosage_per_pill =
    // amount ÷ denominador + grava concentration_volume_ml; senão passthrough (coluna null).
    const payload = { ...form.values, ...normalizeConcentration(form.values) }
    if (isEditing) {
      await update(medicine.id, payload, { goBack: true })
    } else {
      if (scanInfo) {
        logEvent(EVENTS.SCAN_CONFIRMED, {
          surface: SURFACES.MOBILE,
          used_existing: false,
          dose_edited: scanDoseEdited(form.values, scanInfo),
        })
      }
      await create(payload, { goBack: true, source: createSource(scanInfo, anvisaFilledLabel) })
    }
  }, [form, isEditing, medicine, create, update, anvisaFilledLabel, doseCheckRequired, scanInfo, candidatesDecided])

  const handleStrengthChoice = useCallback(
    (choice: CmedStrengthChoice) => {
      form.setValues({ ...form.values, dosage_per_pill: String(choice.dose), dosage_unit: choice.unit })
      setDoseChoiceError(false)
    },
    [form]
  )

  const hasDose = String(form.values.dosage_per_pill ?? '').trim() !== ''
  const askStrength = doseCheckRequired && !hasDose

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>
          {formTitle(isEditing, scanInfo)}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {!isEditing && (
          <AnvisaBanner onPress={openSheet} filledLabel={anvisaFilledLabel} filledSource={scanInfo ? 'scan' : 'search'}>
            <Pressable
              style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
              onPress={openScanner}
              accessibilityRole="button"
              accessibilityLabel="Ler o código de barras"
            >
              <ScanBarcode size={20} color={colors.primary[700]} strokeWidth={2.5} />
              <Text style={styles.scanButtonText}>Ler o código de barras</Text>
              <ChevronRight size={18} color={colors.primary[700]} />
            </Pressable>
          </AnvisaBanner>
        )}

        <View onLayout={handleIdentificationLayout}>
          <FormSection title="Identificação">
            <FormInput
              name="name"
              label="Nome"
              required
              {...formProps(form, 'name')}
            />
            <FormInput
              name="active_ingredient"
              label="Princípio Ativo"
              {...formProps(form, 'active_ingredient')}
            />
          </FormSection>
        </View>

        <FormSection title="Dosagem">
          <View style={styles.row}>
            <View style={styles.rowDose}>
              <FormInput
                name="dosage_per_pill"
                label="Concentração"
                required
                keyboardType="decimal-pad"
                {...formProps(form, 'dosage_per_pill')}
                {...(doseChoiceError && askStrength ? { error: 'Escolha a concentração abaixo' } : null)}
                onChange={handleDoseChange}
              />
            </View>
            <View style={styles.rowUnit}>
              <FormSelect
                name="dosage_unit"
                label="Unidade"
                required
                options={UNIT_OPTIONS}
                {...formProps(form, 'dosage_unit')}
                onChange={handleUnitChange}
              />
            </View>
          </View>
          <StrengthChoiceCard
            askStrength={askStrength}
            strengthLabel={strengthLabel}
            strengthChoices={strengthChoices}
            onChoose={handleStrengthChoice}
          />
          {/* FR-031 (ADR-066): denominador do rótulo. Default 1 mL; muda só p/ Mounjaro etc. */}
          <ConcentrationVolumeField
            dosageUnit={form.values.dosage_unit as string | undefined}
            inputProps={{ ...formProps(form, 'concentration_volume_ml'), onChange: handleDoseChange }}
          />
          {form.values.dosage_unit === 'un' && Number(form.values.dosage_per_pill) > 1 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Dica: Para a unidade genérica 'un.', a concentração deveria ser 1. Caso seu medicamento tenha dosagem química ativa (ex: 500 mg), altere a unidade ao lado para 'mg', 'ui', etc.
              </Text>
            </View>
          )}
        </FormSection>

        <FormSection title="Classificação">
          <FormSelect
            name="type"
            label="Tipo"
            options={TYPE_OPTIONS}
            {...formProps(form, 'type')}
          />
          <FormSelect
            name="presentation"
            label="Apresentação"
            options={presentationOptions}
            {...formProps(form, 'presentation')}
            onChange={handlePresentationChange}
          />
          {form.values.presentation === 'injetavel' && (
            <FormInput
              name="shelf_life_days"
              label="Validade após aberto (dias)"
              keyboardType="number-pad"
              helperText="Dias de uso após abrir o frasco/caneta — confira a bula."
              {...formProps(form, 'shelf_life_days')}
              onChange={handleShelfLifeChange}
            />
          )}
          <FormInput
            name="therapeutic_class"
            label="Classe Terapêutica"
            {...formProps(form, 'therapeutic_class')}
          />
          <FormSelect
            name="regulatory_category"
            label="Categoria Regulatória"
            options={REGULATORY_OPTIONS}
            {...formProps(form, 'regulatory_category')}
          />
          <FormInput
            name="laboratory"
            label="Laboratório"
            {...formProps(form, 'laboratory')}
          />
          <ScanGenericNote scanInfo={scanInfo} />
        </FormSection>
      </ScrollView>

      <FormActions
        primaryLabel={isEditing ? 'Salvar' : 'Criar medicamento'}
        onPrimary={handleSubmit}
        primaryLoading={isLoading}
        secondaryLabel="Cancelar"
        onSecondary={() => navigation.goBack()}
      />
      </KeyboardAvoidingView>

      <MedicineAnvisaSheet
        open={sheetOpen}
        onClose={closeSheet}
        onSelect={handleAnvisaSelect}
        onScan={openScannerFromSheet}
      />
      {scanInfo && !candidatesDecided ? (
        <MedicineCandidatesSheet
          draft={scanInfo}
          onUseExisting={handleUseExisting}
          onCreateNew={handleCreateNew}
          onNoCandidates={handleNoCandidates}
          onClose={handleCandidatesClose}
        />
      ) : null}
    </SafeAreaView>
  )
}

// Tons suaves originais do caixa de aviso do formulário (preserva tom pastel suave)
const FORM_WARNING_BG = '#fffbeb'
const FORM_WARNING_BORDER = '#fef3c7'
const FORM_WARNING_TEXT = '#b45309'

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  rowDose: {
    flex: 2,
  },
  rowUnit: {
    flex: 1,
  },
  warningBox: {
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: FORM_WARNING_BG,
    borderWidth: 1,
    borderColor: FORM_WARNING_BORDER,
    marginTop: spacing[2],
  },
  warningText: {
    fontSize: 13,
    color: FORM_WARNING_TEXT,
    lineHeight: 18,
  },
  // 066 D1 (C5.3): 2º botão do card da ANVISA, mesmo peso da busca.
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[100],
  },
  scanButtonPressed: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  scanButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[700],
  },
  genericBox: {
    marginTop: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    gap: spacing[1],
  },
  genericTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  genericText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
})
