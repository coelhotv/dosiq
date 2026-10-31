// OnboardingMedicineStep — passo 1 do wizard: primeiro remédio (Fase 4 S4.2).
// REUSA o fluxo da Fase 1: medicineService.create + ANVISA sheet + Form Kit
// (PO-8 — orquestra, não recria). Mock: mock-onboarding-passo2.
//
// 066 Slice E (US7, PO-12): esta é a tela 3 de 3 do passo, o "Confira". Recebe a caixa lida
// (`scanDraft`, do leitor — RC3 A) ou a escolha da busca 2C (`searchSelection`, da tela de busca) e
// mostra nome/dose/unidade para conferir; aberta em branco (`manualEntry`, ou caixa/busca que não
// serviram) é o fallback de digitar. A escolha do caminho mora em `OnboardingMedicineChoiceStep`.
// Nada é gravado aqui: o remédio só vai para o contexto do wizard; quem grava é o passo de estoque (INV-1).

import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import {
  medicineCreateSchema,
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  normalizeRegulatoryCategory,
  isLiquidDosageUnit,
  PRESENTATIONS,
  type CmedStrengthChoice,
  defaultIntakeUnitFor,
} from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { AnvisaBanner } from '@medications/components/AnvisaBanner'
import { StrengthChoiceCard } from '@medications/components/StrengthChoiceCard'
import { ConcentrationVolumeField } from '@medications/components/ConcentrationVolumeField'
import { valuesFromDraft, draftExtras, baseFromScan, scanDoseEdited } from '@medications/utils/medicineDraftValues'
import { ROUTES } from '@navigation/routes'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import OnboardingBrandmark from '@features/onboarding/components/OnboardingBrandmark'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const UNIT_OPTIONS = DOSAGE_UNITS.map((value) => ({
  value,
  label: DOSAGE_UNIT_LABELS[value] ?? value,
}))
const DEFAULT_INITIAL = { type: 'medicamento', dosage_unit: 'mg' }

// Campos que esta tela realmente renderiza — o resto do schema (categoria regulatória,
// classe terapêutica, princípio ativo) é preenchido pelo auto-fill da ANVISA e não tem
// onde "destacar" um erro.
const VISIBLE_FIELDS = ['name', 'dosage_per_pill', 'dosage_unit']

const PRESENTATION_SET = new Set<string>(PRESENTATIONS)

// `forms` da base ANVISA (manifest ≥ 1.1.11): só uma forma válida conta; cache antigo não tem.
function singleForm(forms: unknown): string | null {
  if (!Array.isArray(forms)) return null
  const valid = [...new Set(forms.filter((f) => typeof f === 'string' && PRESENTATION_SET.has(f)))]
  return valid.length === 1 ? (valid[0] as string) : null
}

// Líquido := dosage_unit termina em '/ml' (decisão-mãe 022).
const isLiquidUnit = isLiquidDosageUnit

// Nova leitura/escolha = novo objeto no param (popTo com merge); a mesma não se reaplica a cada render.
function isNewParam(value, applied) {
  return !!value && value !== applied
}

// Item da base ANVISA → campos do form (mesmo mapeamento do cadastro F1). Genérico não guarda
// laboratório (D11); o registro só vem com a caixa escolhida (C-C4).
function baseFromAnvisaItem(item, current) {
  const isGeneric = (item.regulatoryCategory ?? '').toLowerCase().startsWith('gener')
  return {
    ...current,
    name: item.name ?? current.name,
    active_ingredient: item.activeIngredient ?? current.active_ingredient,
    therapeutic_class: item.therapeuticClass ?? current.therapeutic_class,
    // 100 B (C-B3): a base ANVISA não traz código; zera o de uma caixa lida antes.
    therapeutic_class_code: null,
    // A base ANVISA traz a categoria crua ('Biologico', 'Gases Medicinais') e o enum é
    // acentuado — sem normalizar, o safeParse falha em `regulatory_category`, um campo
    // que NÃO existe nesta tela: o usuário via "Verifique os campos destacados" sem
    // nenhum campo destacado. Mesma correção já aplicada no cadastro (F1) e na web.
    regulatory_category:
      normalizeRegulatoryCategory(item.regulatoryCategory) ?? current.regulatory_category,
    laboratory: isGeneric ? '' : (item.laboratory ?? current.laboratory ?? ''),
    anvisa_registration: null,
  }
}

function formProps(form, name) {
  return {
    value: form.values[name],
    error: form.touched[name] ? form.errors[name] : undefined,
    onChange: form.handleChange,
    onBlur: form.handleBlur,
  }
}

export default function OnboardingMedicineStep() {
  // States (R-010)
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { medicine, setMedicine, setMedicineSource, setMedicineIntakeUnit, skip } = useOnboarding()
  const { show } = useToast()
  // 066 E: o que veio da caixa (busca 2C ou código de barras) — mesmo estado do cadastro completo.
  const [filledLabel, setFilledLabel] = useState<string | null>(null)
  const [filledSource, setFilledSource] = useState<'search' | 'scan'>('search')
  const [doseCheckRequired, setDoseCheckRequired] = useState(false)
  const [strengthLabel, setStrengthLabel] = useState<string | null>(null)
  const [strengthChoices, setStrengthChoices] = useState<CmedStrengthChoice[]>([])
  const [doseChoiceError, setDoseChoiceError] = useState(false)
  const [appliedScanDraft, setAppliedScanDraft] = useState<any>(null)
  const [appliedSelection, setAppliedSelection] = useState<any>(null)
  // 066 E (C-7): unidade da tomada que a caixa indica, e para qual concentração ela vale.
  const [draftIntake, setDraftIntake] = useState<{ unit: string | null; dosageUnit: string | null } | null>(null)
  // `scan_confirmed` sai 1× por caixa lida: voltar do tratamento e continuar de novo não recontaria.
  const confirmedScanRef = useRef<any>(null)

  const form = useFormState(medicineCreateSchema, { initialValues: medicine || DEFAULT_INITIAL })

  // Aplica a caixa no form + guarda do composto (INV-2), escolhas de 1 toque e "Na embalagem".
  const applyDraft = (values, draft, source: 'search' | 'scan') => {
    form.setValues(values)
    const extras = draftExtras(draft)
    setDoseCheckRequired(extras.doseCheckRequired)
    setStrengthChoices(extras.strengthChoices)
    setStrengthLabel(extras.strengthLabel)
    setDoseChoiceError(false)
    setFilledLabel([draft.name, draft.strengthLabel].filter(Boolean).join(' '))
    setFilledSource(source)
    setDraftIntake({ unit: draft.intake_unit ?? null, dosageUnit: draft.dosage_unit ?? null })
  }

  // US7 cen. 5: a busca devolve { anvisaItem, cmedDraft? }. Com caixa escolhida no passo 2, o rascunho
  // da CMED prevalece (dose/unidade/forma/registro). Sem caixa (offline, sem embalagem): como antes —
  // nome + forma única (Slice C, T023b).
  const applySelection = ({ anvisaItem: item, cmedDraft: draft }) => {
    const base = baseFromAnvisaItem(item, form.values)
    if (draft) {
      applyDraft(valuesFromDraft(base, draft, form.values), draft, 'search')
      return
    }
    const presentation = singleForm(item.forms)
    form.setValues(presentation ? { ...base, presentation } : base)
    setDoseCheckRequired(false)
    setStrengthChoices([])
    setStrengthLabel(null)
    setDoseChoiceError(false)
    setFilledLabel(item.name ?? null)
    setFilledSource('search')
    setDraftIntake(null)
  }

  // Aplicados durante o render, uma vez por objeto. 066 E (T050): `scanDraft` vem do leitor; `scanEan`
  // também volta e é ignorado aqui (não segue p/ o estoque — Non-Goal). `searchSelection` vem da busca.
  const scanDraft = route.params?.scanDraft ?? null
  if (isNewParam(scanDraft, appliedScanDraft)) {
    setAppliedScanDraft(scanDraft)
    applyDraft(valuesFromDraft(baseFromScan(scanDraft, form.values), scanDraft, form.values), scanDraft, 'scan')
  }
  const searchSelection = route.params?.searchSelection ?? null
  if (isNewParam(searchSelection, appliedSelection)) {
    setAppliedSelection(searchSelection)
    applySelection(searchSelection)
  }

  // Memos (R-010)
  // Voltar = escolher outro caminho (caixa ou busca).
  const headerProps = useMemo(
    () => ({ step: 1, totalSteps: 4, onBack: () => navigation.goBack(), onSkip: () => skip(1) }),
    [navigation, skip],
  )

  // Handlers
  // "Trocar" no selo de origem: volta à escolha do caminho.
  const handleChange = useCallback(() => navigation.popTo(ROUTES.ONBOARDING_MEDICINE), [navigation])

  const handleStrengthChoice = useCallback(
    (choice: CmedStrengthChoice) => {
      form.setValues({ ...form.values, dosage_per_pill: String(choice.dose), dosage_unit: choice.unit })
      setDoseChoiceError(false)
    },
    [form],
  )

  // Concentração e volume do rótulo (spec 113): só número decimal, vírgula vira ponto.
  const handleDecimalChange = useCallback(
    (name, value) => {
      const cleaned = String(value ?? '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '')
        .replace(/^(\d*\.\d*).*$/, '$1')
      form.handleChange(name, cleaned)
    },
    [form],
  )

  // /ml → presentation='liquido' (densidade pertence ao tratamento — 022 Fase C).
  const handleUnitChange = useCallback(
    (_name, value) => {
      form.handleChange('dosage_unit', value)
      form.handleChange('presentation', isLiquidUnit(value) ? 'liquido' : 'comprimido')
    },
    [form],
  )

  const handleContinue = useCallback(() => {
    // INV-2 (C-C2): composto ambíguo exige a escolha — o Zod aceita dose vazia.
    if (doseCheckRequired && String(form.values.dosage_per_pill ?? '').trim() === '') {
      setDoseChoiceError(true)
      show('Escolha a concentração do remédio.', { variant: 'error' })
      return
    }
    if (!form.validate()) {
      // "Verifique os campos destacados" só ajuda se houver campo destacado. Erro em campo
      // que esta tela não renderiza (ex: regulatory_category vinda da ANVISA) deixava o
      // usuário travado sem nenhuma pista. Reparseia aqui porque `form.errors` só reflete o
      // validate() no render seguinte — dentro deste handler ainda é o valor anterior.
      const issues = medicineCreateSchema.safeParse(form.values).error?.issues ?? []
      const hidden = issues.find((issue) => !VISIBLE_FIELDS.includes(String(issue.path[0])))
      const hasVisible = issues.some((issue) => VISIBLE_FIELDS.includes(String(issue.path[0])))
      show(
        !hasVisible && hidden ? hidden.message : 'Verifique os campos destacados',
        { variant: 'error' },
      )
      return
    }
    // 066 E (TRACKING_PLAN §5.3): de onde veio o remédio, para o `medicine_added` do passo de estoque.
    const source = filledLabel ? (filledSource === 'scan' ? 'scan' : 'anvisa_search') : 'manual'
    // A caixa lida virou decisão ao "Continuar" (D1: no form é o "Criar"); nada é gravado aqui (INV-1).
    if (source === 'scan' && appliedScanDraft && confirmedScanRef.current !== appliedScanDraft) {
      confirmedScanRef.current = appliedScanDraft
      logEvent(EVENTS.SCAN_CONFIRMED, {
        surface: SURFACES.MOBILE,
        used_existing: false,
        dose_edited: scanDoseEdited(form.values, appliedScanDraft),
      })
    }
    setMedicine(form.values)
    setMedicineSource(source)
    // C-7: a unidade da caixa só vale se a concentração ainda é a da caixa; senão, o padrão do form completo.
    const dosageUnit = form.values.dosage_unit as string | undefined
    setMedicineIntakeUnit(
      draftIntake?.unit && draftIntake.dosageUnit === dosageUnit ? draftIntake.unit : defaultIntakeUnitFor(dosageUnit),
    )
    ;(navigation.navigate as any)(ROUTES.ONBOARDING_TREATMENT)
  }, [form, show, setMedicine, setMedicineSource, setMedicineIntakeUnit, navigation, doseCheckRequired, filledLabel, filledSource, appliedScanDraft, draftIntake])

  const hasDose = String(form.values.dosage_per_pill ?? '').trim() !== ''
  const askStrength = doseCheckRequired && !hasDose

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OnboardingHeader {...(headerProps as any)} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <OnboardingBrandmark />

          <Text style={styles.title}>{filledLabel ? 'Confira o seu remédio' : 'Seu primeiro remédio'}</Text>
          <Text style={styles.subtitle}>
            {filledLabel
              ? 'Veja se nome e concentração batem com a caixa. Pode corrigir qualquer campo.'
              : 'Comece pelo remédio que você mais lembra. Pode mudar depois.'}
          </Text>

          {filledLabel ? (
            <AnvisaBanner onPress={handleChange} filledLabel={filledLabel} filledSource={filledSource} />
          ) : null}

          <FormInput
            name="name"
            label="Nome do remédio"
            required
            placeholder="Digite o nome do remédio"
            {...formProps(form, 'name')}
          />

          <View style={styles.row}>
            <View style={styles.rowDose}>
              <FormInput
                name="dosage_per_pill"
                label="Concentração"
                required
                keyboardType="decimal-pad"
                {...formProps(form, 'dosage_per_pill')}
                {...(doseChoiceError && askStrength ? { error: 'Escolha a concentração abaixo' } : null)}
                onChange={handleDecimalChange}
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
          {/* Spec 113 (FR-005): mesmo campo e condição do form completo; razão só na gravação. */}
          <ConcentrationVolumeField
            dosageUnit={form.values.dosage_unit as string | undefined}
            inputProps={{ ...formProps(form, 'concentration_volume_ml'), onChange: handleDecimalChange }}
          />
          <StrengthChoiceCard
            askStrength={askStrength}
            strengthLabel={strengthLabel}
            strengthChoices={strengthChoices}
            onChoose={handleStrengthChoice}
          />
          {/* 066 C (paliativo) → E (C6.6): só quando a dose não veio da caixa (manual, offline, sem embalagem). */}
          {!(filledLabel && hasDose) && !askStrength && (
            <Text style={styles.doseHint}>Copie o número escrito na embalagem ou na receita.</Text>
          )}

          {form.values.dosage_unit === 'un' && Number(form.values.dosage_per_pill) > 1 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Dica: Para a unidade genérica 'un.', a concentração deveria ser 1. Caso seu medicamento tenha dosagem química ativa (ex: 500 mg), altere a unidade ao lado para 'mg', 'ui', etc.
              </Text>
            </View>
          )}
        </ScrollView>

        <FormActions
          primaryLabel="Continuar"
          onPrimary={handleContinue}
          primaryLoading={false}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// Tons suaves originais do caixa de aviso do onboarding (preserva tom pastel suave)
const ONBOARDING_WARNING_BG = '#fffbeb'
const ONBOARDING_WARNING_BORDER = '#fef3c7'
const ONBOARDING_WARNING_TEXT = '#b45309'

const styles = StyleSheet.create({
  doseHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
    marginTop: -spacing[2],
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
    fontFamily: typography.fontFamily.bold,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 21,
    marginTop: -spacing[2],
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
    backgroundColor: ONBOARDING_WARNING_BG,
    borderWidth: 1,
    borderColor: ONBOARDING_WARNING_BORDER,
    marginTop: spacing[1],
  },
  warningText: {
    fontSize: 13,
    color: ONBOARDING_WARNING_TEXT,
    lineHeight: 18,
  },
})
