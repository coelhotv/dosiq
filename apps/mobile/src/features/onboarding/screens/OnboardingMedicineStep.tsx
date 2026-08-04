// OnboardingMedicineStep — passo 1 do wizard: primeiro remédio (Fase 4 S4.2).
// REUSA o fluxo da Fase 1: medicineService.create + ANVISA sheet + Form Kit
// (PO-8 — orquestra, não recria). Mock: mock-onboarding-passo2.

import { useCallback, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Info } = LucideIcons as any
import {
  medicineCreateSchema,
  DOSAGE_UNITS,
  DOSAGE_UNIT_LABELS,
  normalizeRegulatoryCategory,
  isLiquidDosageUnit,
} from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import { useMedicineDatabase } from '@shared/hooks/useMedicineDatabase'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormAutocomplete from '@shared/components/form/FormAutocomplete'
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { ROUTES } from '@navigation/routes'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
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

// Líquido := dosage_unit termina em '/ml' (decisão-mãe 022).
const isLiquidUnit = isLiquidDosageUnit

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
  const navigation = useNavigation()
  const { medicine, setMedicine, finish } = useOnboarding()
  const { show } = useToast()
  const { search } = useMedicineDatabase()

  const form = useFormState(medicineCreateSchema, { initialValues: medicine || DEFAULT_INITIAL })

  // Memos (R-010)
  // Passo 2 de 3 (passo 1 = criar conta, no signup). Sem voltar (é a 1ª tela
  // pós-login do wizard).
  const headerProps = useMemo(() => ({ step: 1, totalSteps: 4, onSkip: finish }), [finish])

  // Handlers
  // Auto-fill ao escolher uma sugestão ANVISA (mesmo mapeamento do cadastro F1).
  const handleAnvisaSelect = useCallback(
    (item) => {
      form.setValues({
        name: item.name ?? form.values.name,
        active_ingredient: item.activeIngredient ?? form.values.active_ingredient,
        therapeutic_class: item.therapeuticClass ?? form.values.therapeutic_class,
        // A base ANVISA traz a categoria crua ('Biologico', 'Gases Medicinais') e o enum é
        // acentuado — sem normalizar, o safeParse falha em `regulatory_category`, um campo
        // que NÃO existe nesta tela: o usuário via "Verifique os campos destacados" sem
        // nenhum campo destacado. Mesma correção já aplicada no cadastro (F1) e na web.
        regulatory_category:
          normalizeRegulatoryCategory(item.regulatoryCategory) ?? form.values.regulatory_category,
      })
    },
    [form],
  )

  const anvisaSubtitle = useCallback(
    (item) => [item.laboratory, item.activeIngredient].filter(Boolean).join(' · '),
    [],
  )

  const handleDoseChange = useCallback(
    (_name, value) => {
      const cleaned = String(value ?? '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '')
        .replace(/^(\d*\.\d*).*$/, '$1')
      form.handleChange('dosage_per_pill', cleaned)
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
    setMedicine(form.values)
    ;(navigation.navigate as any)(ROUTES.ONBOARDING_TREATMENT)
  }, [form, show, setMedicine, navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <OnboardingHeader {...(headerProps as any)} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandmark}>
            <Image
              source={require('../../../../assets/icon.png')}
              style={styles.brandIcon}
              resizeMode="contain"
            />
            <Text style={styles.brandText}>dosiq</Text>
          </View>

          <Text style={styles.title}>Seu primeiro remédio</Text>
          <Text style={styles.subtitle}>
            Comece pelo remédio que você mais lembra. Pode mudar depois.
          </Text>

          <FormAutocomplete
            name="name"
            label="Nome do remédio"
            required
            placeholder="Digite o nome do remédio"
            value={form.values.name}
            error={form.touched.name ? form.errors.name : undefined}
            onChange={form.handleChange}
            onBlur={form.handleBlur}
            search={search}
            getItemSubtitle={anvisaSubtitle}
            onSelect={handleAnvisaSelect}
            disabled={false}
          />

          {/* Dica ANVISA (mock-onboarding-passo2) */}
          <View style={styles.anvisaHint}>
            <Info size={18} color={colors.primary[700]} strokeWidth={2} />
            <Text style={styles.anvisaHintText}>
              Não sabe o nome certo? Digite o que está na caixa — a gente sugere o nome oficial pela base da Anvisa.
            </Text>
          </View>

          <View style={styles.row}>
            <View style={styles.rowDose}>
              <FormInput
                name="dosage_per_pill"
                label="Concentração"
                required
                keyboardType="decimal-pad"
                {...formProps(form, 'dosage_per_pill')}
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
  anvisaHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  anvisaHintText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary[700],
    lineHeight: 18,
  },
  brandmark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    alignSelf: 'center',
  },
  brandIcon: {
    width: 28,
    height: 28,
  },
  brandText: {
    fontSize: 20,
    fontFamily: typography.fontFamily.brand,
    color: colors.text.brand,
    marginLeft: spacing[1],
    fontWeight: '700',
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
