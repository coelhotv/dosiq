// OnboardingMedicineStep — passo 1 do wizard: primeiro remédio (Fase 4 S4.2).
// REUSA o fluxo da Fase 1: medicineService.create + ANVISA sheet + Form Kit
// (PO-8 — orquestra, não recria). Mock: mock-onboarding-passo2.

import { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Info } from 'lucide-react-native'
import { medicineCreateSchema, DOSAGE_UNITS } from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import { useMedicineDatabase } from '@shared/hooks/useMedicineDatabase'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormAutocomplete from '@shared/components/form/FormAutocomplete'
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { medicineService } from '@medications/services/medicineService'
import { ROUTES } from '@navigation/routes'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const UNIT_OPTIONS = DOSAGE_UNITS.map((value) => ({ value, label: value }))
const DEFAULT_INITIAL = { type: 'medicamento', dosage_unit: 'mg' }

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
  const { setMedicine, finish } = useOnboarding()
  const { show } = useToast()
  const { search } = useMedicineDatabase()
  const [saving, setSaving] = useState(false)

  const form = useFormState(medicineCreateSchema, { initialValues: DEFAULT_INITIAL })

  // Handlers
  // Auto-fill ao escolher uma sugestão ANVISA (mesmo mapeamento do cadastro F1).
  const handleAnvisaSelect = useCallback(
    (item) => {
      form.setValues({
        name: item.name ?? form.values.name,
        active_ingredient: item.activeIngredient ?? form.values.active_ingredient,
        therapeutic_class: item.therapeuticClass ?? form.values.therapeutic_class,
        regulatory_category: item.regulatoryCategory ?? form.values.regulatory_category,
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

  const handleContinue = useCallback(async () => {
    if (!form.validate()) {
      show('Verifique os campos destacados', { variant: 'error' })
      return
    }
    setSaving(true)
    try {
      const created = await medicineService.create(form.values)
      setMedicine({ id: created.id, name: created.name })
      navigation.navigate(ROUTES.ONBOARDING_TREATMENT)
    } catch (err) {
      show(err?.message ?? 'Erro ao salvar remédio', { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [form, show, setMedicine, navigation])

  // Passo 2 de 3 (passo 1 = criar conta, no signup). Sem voltar (é a 1ª tela
  // pós-login do wizard).
  const headerProps = useMemo(() => ({ step: 1, totalSteps: 3, onSkip: finish }), [finish])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader {...headerProps} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          />

          {/* Dica ANVISA (mock-onboarding-passo2) */}
          <View style={styles.anvisaHint}>
            <Info size={18} color={colors.primary[700]} strokeWidth={2} />
            <Text style={styles.anvisaHintText}>
              Não sabe o nome certo? Digite o que está na caixa — a gente sugere o nome oficial.
            </Text>
          </View>

          <View style={styles.row}>
            <View style={styles.rowDose}>
              <FormInput
                name="dosage_per_pill"
                label="Dosagem"
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
              />
            </View>
          </View>
        </ScrollView>

        <FormActions
          primaryLabel="Continuar"
          onPrimary={handleContinue}
          primaryLoading={saving}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

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
})
