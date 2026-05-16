// MedicineFormScreen.jsx — tela unificada create + edit (Sprint M1.2)
//
// Recebe `medicine` em route.params para modo edição. Sem param = modo criação.
// ANVISA bottom sheet preenche campos automaticamente via setValues.

import { useState, useCallback, useMemo } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ChevronLeft } from 'lucide-react-native'
import {
  medicineCreateSchema,
  MEDICINE_TYPES,
  MEDICINE_TYPE_LABELS,
  DOSAGE_UNITS,
  REGULATORY_CATEGORIES,
  REGULATORY_CATEGORY_LABELS,
} from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormSection from '@shared/components/form/FormSection'
import FormActions from '@shared/components/form/FormActions'
import { useMedicineMutation } from '@medications/hooks/useMedicineMutation'
import { AnvisaBanner } from '@medications/components/AnvisaBanner'
import { MedicineAnvisaSheet } from '@medications/components/MedicineAnvisaSheet'
import { colors, spacing, typography } from '@shared/styles/tokens'

const TYPE_OPTIONS = MEDICINE_TYPES.map((value) => ({
  value,
  label: MEDICINE_TYPE_LABELS[value] ?? value,
}))

const UNIT_OPTIONS = DOSAGE_UNITS.map((value) => ({ value, label: value }))

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
  const navigation = useNavigation()
  const route = useRoute()
  const [sheetOpen, setSheetOpen] = useState(false)
  const medicine = route.params?.medicine ?? null
  const isEditing = !!medicine

  // Memos
  // FormInput espera string. Converter dosage_per_pill (number no DB) para string
  // ao carregar para edição. Outros campos number-like seguem mesma regra.
  const initialValues = useMemo(() => {
    if (!medicine) return DEFAULT_INITIAL
    return {
      ...medicine,
      dosage_per_pill:
        medicine.dosage_per_pill !== null && medicine.dosage_per_pill !== undefined
          ? String(medicine.dosage_per_pill)
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
        regulatory_category: item.regulatoryCategory ?? form.values.regulatory_category,
        laboratory: isGeneric ? '' : (item.laboratory ?? form.values.laboratory ?? ''),
      })
      setSheetOpen(false)
    },
    [form]
  )

  // Normaliza vírgula→ponto em tempo real (PT-BR digita 1,5; JS/Postgres esperam 1.5).
  // Aceita apenas dígitos + um separador decimal único.
  const handleDoseChange = useCallback(
    (_name, value) => {
      const cleaned = String(value ?? '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '')
        // colapsa múltiplos pontos no primeiro
        .replace(/^(\d*\.\d*).*$/, '$1')
      form.handleChange('dosage_per_pill', cleaned)
    },
    [form]
  )

  const handleSubmit = useCallback(async () => {
    if (!form.validate()) return
    if (isEditing) {
      await update(medicine.id, form.values, { goBack: true })
    } else {
      await create(form.values, { goBack: true })
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

      <ScrollView
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
                label="Dose por unidade"
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
        </FormSection>

        <FormSection title="Classificação">
          <FormSelect
            name="type"
            label="Tipo"
            options={TYPE_OPTIONS}
            {...formProps(form, 'type')}
          />
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
})
