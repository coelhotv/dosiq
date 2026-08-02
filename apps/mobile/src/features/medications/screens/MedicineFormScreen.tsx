// MedicineFormScreen.jsx — tela unificada create + edit (Sprint M1.2)
//
// Recebe `medicine` em route.params para modo edição. Sem param = modo criação.
// ANVISA bottom sheet preenche campos automaticamente via setValues.

import { useState, useCallback, useMemo } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob
// apps/mobile/tsconfig.json — ver nota em TreatmentsScreen.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft } = LucideIcons as any
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
  cleanFloat,
  isLiquidDosageUnit,
} from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormSection from '@shared/components/form/FormSection'
import FormActions from '@shared/components/form/FormActions'
import { useMedicineMutation } from '@medications/hooks/useMedicineMutation'
import { AnvisaBanner } from '@medications/components/AnvisaBanner'
import { MedicineAnvisaSheet } from '@medications/components/MedicineAnvisaSheet'
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

function formProps(form, name) {
  return {
    value: form.values[name],
    error: form.touched[name] ? form.errors[name] : undefined,
    onChange: form.handleChange,
    onBlur: form.handleBlur,
  }
}

// eslint-disable-next-line max-lines-per-function
export default function MedicineFormScreen() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const [sheetOpen, setSheetOpen] = useState(false)
  const medicine = route.params?.medicine ?? null
  const isEditing = !!medicine

  // Memos
  // FormInput espera string. Converter dosage_per_pill (number no DB) para string
  // ao carregar para edição. Outros campos number-like seguem mesma regra.
  const initialValues = useMemo(() => {
    if (!medicine) return DEFAULT_INITIAL
    // FR-031 (ADR-066): o campo exibe o `amount` do rótulo = razão × volume; transforma só
    // quando há denominador salvo (≠ null). Senão exibe a razão crua (volume 1).
    const denom = Number(medicine.concentration_volume_ml)
    const ratio = Number(medicine.dosage_per_pill)
    const amountStr =
      medicine.dosage_per_pill !== null && medicine.dosage_per_pill !== undefined
        ? String(denom > 0 ? cleanFloat(ratio * denom) : medicine.dosage_per_pill)
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

  // Hooks dependentes (consomem memos acima)
  // Usa createSchema para create + edit — em edit todos obrigatórios continuam exigidos
  // (não pode apagar nome/dose/unidade ao editar).
  const form = useFormState(medicineCreateSchema, { initialValues })
  const { create, update, isLoading } = useMedicineMutation()

  // Handlers
  const openSheet = useCallback(() => setSheetOpen(true), [])
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const handleAnvisaSelect = useCallback(
    (item) => {
      // Genéricos não trazem laboratório (será preenchido no estoque por compra).
      // Demais categorias: usar laboratory do registro ANVISA.
      const isGeneric = (item.regulatoryCategory ?? '')
        .toLowerCase()
        .startsWith('gener')
      form.setValues({
        name: item.name ?? form.values.name,
        active_ingredient: item.activeIngredient ?? form.values.active_ingredient,
        therapeutic_class: item.therapeuticClass ?? form.values.therapeutic_class,
        // Base ANVISA traz a categoria sem acento/normalização ('Biologico'); o Picker
        // (esp. iOS, match estrito) só casa o valor canônico acentuado ('Biológico').
        // normalizeRegulatoryCategory mapeia p/ o enum canônico — mesma correção da web.
        regulatory_category:
          normalizeRegulatoryCategory(item.regulatoryCategory) ?? form.values.regulatory_category,
        laboratory: isGeneric ? '' : (item.laboratory ?? form.values.laboratory ?? ''),
      })
      setSheetOpen(false)
    },
    [form]
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
    const isLiquid = isLiquidUnit(form.values.dosage_unit as string | undefined)
    const rawDenom = isLiquid ? Number(String(form.values.concentration_volume_ml ?? '').replace(',', '.')) : NaN
    const denom = rawDenom > 0 ? rawDenom : 1
    // Gemini #661: dosage_per_pill vazio (permitido p/ suplemento) → Number('')=0 salvaria 0
    // em vez de null, corrompendo o dado. Só converte quando há valor preenchido.
    const rawAmount = form.values.dosage_per_pill
    const hasAmount = rawAmount !== '' && rawAmount !== null && rawAmount !== undefined
    const amount = hasAmount ? Number(String(rawAmount).replace(',', '.')) : NaN
    const payload = {
      ...form.values,
      dosage_per_pill: hasAmount && Number.isFinite(amount) ? cleanFloat(amount / denom) : null,
      concentration_volume_ml: denom !== 1 ? denom : null,
    }
    if (isEditing) {
      await update(medicine.id, payload, { goBack: true })
    } else {
      await create(payload, { goBack: true })
    }
  }, [form, isEditing, medicine, create, update])

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
          {isEditing ? 'Editar Medicamento' : 'Novo Medicamento'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {!isEditing && <AnvisaBanner onPress={openSheet} />}

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

        <FormSection title="Dosagem">
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
          {/* FR-031 (ADR-066): denominador do rótulo. Default 1 mL; muda só p/ Mounjaro etc. */}
          {isLiquidUnit(form.values.dosage_unit as string | undefined) && (
            <FormInput
              name="concentration_volume_ml"
              label="Volume da concentração (mL no rótulo)"
              keyboardType="decimal-pad"
              placeholder="1"
              helperText='Padrão é 1 mL (ou só mL). Mude se o rótulo trouxer outro volume, ex.: "Mounjaro 2,5 mg / 0,5 mL" — preencha 0,5.' /* unit-label-gate: ok — copy estática de ajuda (053/PO-5) */
              {...formProps(form, 'concentration_volume_ml')}
              onChange={handleDoseChange}
            />
          )}
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
            options={PRESENTATION_OPTIONS}
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
      />
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
    backgroundColor: colors.supplement[50],
    borderWidth: 1,
    borderColor: colors.supplement[500],
    marginTop: spacing[2],
  },
  warningText: {
    fontSize: 13,
    color: colors.supplement[500],
    lineHeight: 18,
  },
})
