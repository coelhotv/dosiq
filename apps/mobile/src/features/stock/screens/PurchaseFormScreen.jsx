// PurchaseFormScreen.jsx — tela CREATE + EDIT de compra de estoque (S1.5 Wave 3).
//
// Recebe em route.params:
//   mode: 'create' | 'edit'    (obrigatório)
//   medicineId: string          (obrigatório — PO-3: medicamento sempre travado)
//   medicineName: string        (nome exibido na row superior read-only)
//   purchaseId?: string         (apenas mode='edit')
//   purchase?: object           (apenas mode='edit' — preenche form)
//
// R-010: States → Memos → Effects → Handlers
// AP-167: decimal PT-BR — estados intermediários ("0,", ".", "") preservados como
//         string; coerce via overrides no submit (evita race com handleChange async).
// ADR-046: unidade sempre presente no label de quantidade.
// ADR-028: StyleSheet. ADR-023: fontWeights >= 400.

import { useCallback, useMemo, useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ChevronLeft, Package } from 'lucide-react-native'
import { stockCreateSchema, getTodayLocal, parseLocalDate, formatLocalDate, getNow, formatActiveIngredientShort, INJECTION_CONTAINERS, INJECTION_CONTAINER_LABELS } from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormDatePicker from '@shared/components/form/FormDatePicker'
import FormSection from '@shared/components/form/FormSection'
import FormActions from '@shared/components/form/FormActions'
import { useStockMutation } from '@stock/hooks/useStockMutation'
import { medicineService } from '@medications/services/medicineService'
import { colors, spacing, typography, borderRadius } from '@shared/styles/tokens'

// Regra de laboratório por categoria regulatória ANVISA:
//   - Genérico        → NÃO pré-preenche (fabricante varia por lote/compra)
//   - null/desconhecida → pré-preenche se houver lab, mas NÃO trava (editável)
//   - demais categorias → pré-preenche E trava (marca registrada, lab fixo)
const VARIABLE_LAB_CATEGORIES = ['Genérico']

// Genérico nunca pré-preenche; resto sim (inclusive null).
function shouldPrefillLab(category) {
  return !VARIABLE_LAB_CATEGORIES.includes(category)
}

// Só trava quando a categoria é conhecida e não é Genérico.
function shouldLockLab(category) {
  return Boolean(category) && !VARIABLE_LAB_CATEGORIES.includes(category)
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de decimal PT-BR (AP-167)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Mantém o valor decimal como string PT-BR (AP-167) durante a digitação,
 * normalizando ponto → vírgula. A coerção para número só acontece no submit
 * via coerceDecimal — assim o input exibe vírgula (PT-BR) e a camada de dados
 * não fica acoplada a requisitos de UI.
 */
function parseDecimalPtBR(raw) {
  return String(raw ?? '').replace('.', ',')
}

/**
 * Coerce valor de campo decimal para número (usado no submit com overrides).
 * Retorna undefined se vazio/inválido (campos opcionais aceitam undefined).
 */
function coerceDecimal(raw) {
  if (raw === '' || raw === undefined || raw === null) return undefined
  const str = String(raw).replace(',', '.')
  const num = Number(str)
  return Number.isFinite(num) ? num : undefined
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper para props comuns de FormInput via useFormState
// ──────────────────────────────────────────────────────────────────────────────
function formProps(form, name) {
  return {
    value: form.values[name] != null ? String(form.values[name]) : '',
    error: form.touched[name] ? form.errors[name] : undefined,
    onChange: form.handleChange,
    onBlur: form.handleBlur,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Helpers puros para reduzir tamanho e complexidade do hook
// ──────────────────────────────────────────────────────────────────────────────

function getInitialValues(isEdit, purchase, todayIso) {
  if (isEdit && purchase) {
    const q = purchase.quantity_bought ?? purchase.quantity
    return {
      quantity: q != null ? String(q).replace('.', ',') : '',
      unit_price:
        purchase.unit_price != null && purchase.unit_price !== 0
          ? String(purchase.unit_price).replace('.', ',')
          : '',
      purchase_date: purchase.purchase_date ?? todayIso,
      expiration_date: purchase.expiration_date ?? null,
      pharmacy: purchase.pharmacy ?? '',
      laboratory: purchase.laboratory ?? '',
      notes: purchase.notes ?? '',
    }
  }
  return {
    quantity: '',
    unit_price: '',
    purchase_date: todayIso,
    expiration_date: null,
    pharmacy: '',
    laboratory: '',
    notes: '',
  }
}

function getQuantityHelperText(isEdit, quantity, medicine) {
  if (isEdit) return 'Corrija o saldo pelo "Acertar saldo"'
  if (!medicine) return undefined
  const shortHint = formatActiveIngredientShort(
    quantity,
    medicine.dosage_per_pill,
    medicine.dosage_unit
  )
  return shortHint ? `✨ Equivale a ${shortHint} no total` : undefined
}

function calculateCoercedValues(useLiquidInputs, numBottles, volumePerBottle, totalPrice, formValues) {
  if (useLiquidInputs) {
    const bottles = coerceDecimal(numBottles)
    const volume = coerceDecimal(volumePerBottle)
    if (!bottles || bottles <= 0 || !volume || volume <= 0) {
      return null
    }
    const quantityCoerced = bottles * volume
    const total = coerceDecimal(totalPrice)
    const priceCoerced =
      total && total > 0 && quantityCoerced > 0
        ? Math.floor((total / quantityCoerced) * 10000) / 10000
        : undefined
    return { quantityCoerced, priceCoerced }
  }

  return {
    quantityCoerced: coerceDecimal(formValues.quantity),
    priceCoerced: coerceDecimal(formValues.unit_price),
  }
}

function validatePurchaseForm(form, overrides) {
  if (!form.validate(overrides)) {
    const parsed = stockCreateSchema.safeParse({ ...form.values, ...overrides })
    const firstError = parsed.success ? null : parsed.error.issues[0]?.message
    Alert.alert('Verifique o formulário', firstError || 'Há campos obrigatórios não preenchidos.')
    return false
  }
  return true
}

async function submitPurchasePayload({
  isEdit,
  useLiquidInputs,
  payload,
  purchaseId,
  medicineId,
  numBottles,
  volumePerBottle,
  totalPrice,
  isInjectable,
  injectionContainer,
  updatePurchase,
  createLiquidPurchase,
  createPurchase,
}) {
  if (isEdit) {
    await updatePurchase(purchaseId, payload, { goBack: true })
    return
  }

  if (useLiquidInputs) {
    const bottlesCount = Math.trunc(coerceDecimal(numBottles) || 0)
    if (bottlesCount <= 0) {
      Alert.alert('Verifique o formulário', 'O número de frascos deve ser pelo menos 1.')
      return
    }
    await createLiquidPurchase(
      {
        medicineId,
        numBottles: bottlesCount,
        volumePerBottle: coerceDecimal(volumePerBottle),
        totalPrice: coerceDecimal(totalPrice) || 0,
        purchaseDate: payload.purchase_date,
        expirationDate: payload.expiration_date,
        pharmacy: payload.pharmacy,
        laboratory: payload.laboratory,
        notes: payload.notes,
        injectionContainer: isInjectable ? injectionContainer || null : null,
      },
      { goBack: true },
    )
    return
  }

  await createPurchase(payload, { goBack: true })
}

// ──────────────────────────────────────────────────────────────────────────────
// Custom hook para encapsular o estado e lógica da tela
// ──────────────────────────────────────────────────────────────────────────────
function usePurchaseForm(route, navigation) {
  const [labLocked, setLabLocked] = useState(false)
  const [medicine, setMedicine] = useState(null)
  const [numBottles, setNumBottles] = useState('')
  const [volumePerBottle, setVolumePerBottle] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [injectionContainer, setInjectionContainer] = useState(
    () => route.params?.purchase?.injection_container || ''
  )

  const {
    mode = 'create',
    medicineId,
    medicineName,
    purchaseId,
    purchase,
  } = route.params ?? {}

  const isEdit = mode === 'edit'
  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))
  const useLiquidInputs = isLiquid && !isEdit
  const isInjectable = medicine?.presentation === 'injetavel'
  const needsContainer = isInjectable

  const todayIso = useMemo(() => getTodayLocal(), [])
  const initialValues = useMemo(() => getInitialValues(isEdit, purchase, todayIso), [isEdit, purchase, todayIso])

  const form = useFormState(stockCreateSchema, { initialValues })
  const { createPurchase, createLiquidPurchase, updatePurchase, isLoading } = useStockMutation()
  const { handleChange } = form

  const purchaseDateObj = useMemo(() => form.values.purchase_date ? parseLocalDate(form.values.purchase_date) : null, [form.values.purchase_date])
  const expirationDateObj = useMemo(() => form.values.expiration_date ? parseLocalDate(form.values.expiration_date) : null, [form.values.expiration_date])

  const quantityHelperText = useMemo(
    () => getQuantityHelperText(isEdit, form.values.quantity, medicine),
    [isEdit, form.values.quantity, medicine]
  )

  useEffect(() => {
    if (!medicineId) return
    let cancelled = false
    medicineService
      .getById(medicineId)
      .then((med) => {
        if (cancelled || !med) return
        setMedicine(med)
        if (med.laboratory && shouldPrefillLab(med.regulatory_category)) {
          handleChange('laboratory', med.laboratory)
          setLabLocked(shouldLockLab(med.regulatory_category))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [medicineId, handleChange])

  const handleQuantityChange = useCallback((_name, raw) => form.handleChange('quantity', parseDecimalPtBR(raw)), [form])
  const handlePriceChange = useCallback((_name, raw) => form.handleChange('unit_price', parseDecimalPtBR(raw)), [form])
  const handlePurchaseDateChange = useCallback((_name, date) => form.handleChange('purchase_date', date ? formatLocalDate(date) : todayIso), [form, todayIso])
  const handleExpirationDateChange = useCallback((_name, date) => form.handleChange('expiration_date', date ? formatLocalDate(date) : null), [form])

  const handleSubmit = useCallback(async () => {
    const coerced = calculateCoercedValues(useLiquidInputs, numBottles, volumePerBottle, totalPrice, form.values)
    if (useLiquidInputs && !coerced) {
      Alert.alert('Verifique o formulário', 'Informe o número de frascos e o volume por frasco (ml).')
      return
    }

    const { quantityCoerced, priceCoerced } = coerced
    const overrides = {
      medicine_id: medicineId,
      quantity: quantityCoerced,
      unit_price: priceCoerced !== undefined ? priceCoerced : undefined,
    }

    if (!validatePurchaseForm(form, overrides)) return

    const payload = {
      medicine_id: medicineId,
      quantity: quantityCoerced,
      purchase_date: form.values.purchase_date,
      expiration_date: form.values.expiration_date || null,
      unit_price: priceCoerced !== undefined ? priceCoerced : undefined,
      pharmacy: form.values.pharmacy || null,
      laboratory: form.values.laboratory || null,
      notes: form.values.notes || null,
      injection_container: isInjectable ? injectionContainer || null : null,
    }

    await submitPurchasePayload({
      isEdit,
      useLiquidInputs,
      payload,
      purchaseId,
      medicineId,
      numBottles,
      volumePerBottle,
      totalPrice,
      isInjectable,
      injectionContainer,
      updatePurchase,
      createLiquidPurchase,
      createPurchase,
    })
  }, [form, isEdit, medicineId, purchaseId, createPurchase, createLiquidPurchase, updatePurchase, useLiquidInputs, numBottles, volumePerBottle, totalPrice, isInjectable, injectionContainer])

  const goBack = useCallback(() => navigation.goBack(), [navigation])

  const screenTitle = isEdit ? 'Editar compra' : 'Registrar compra'
  const ctaLabel = isEdit ? 'Salvar alterações' : 'Registrar compra'

  return {
    mode,
    medicineId,
    medicineName,
    purchaseId,
    purchase,
    isEdit,
    isLiquid,
    useLiquidInputs,
    needsContainer,
    form,
    isLoading,
    purchaseDateObj,
    expirationDateObj,
    quantityHelperText,
    numBottles,
    setNumBottles,
    volumePerBottle,
    setVolumePerBottle,
    totalPrice,
    setTotalPrice,
    injectionContainer,
    setInjectionContainer,
    labLocked,
    handleQuantityChange,
    handlePriceChange,
    handlePurchaseDateChange,
    handleExpirationDateChange,
    handleSubmit,
    goBack,
    screenTitle,
    ctaLabel,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Funções Auxiliares de Renderização (para manter TextInputs inline)
// ──────────────────────────────────────────────────────────────────────────────

function renderLiquidInputs(state) {
  return (
    <FormSection title="Quantidade e preço">
      <View style={styles.row}>
        <View style={styles.rowHalf}>
          <FormInput
            name="num_bottles"
            label="Nº de frascos"
            required
            placeholder="1"
            keyboardType="decimal-pad"
            maxLength={6}
            value={state.numBottles}
            onChange={(_n, raw) => state.setNumBottles(parseDecimalPtBR(raw))}
          />
        </View>
        <View style={styles.rowHalf}>
          <FormInput
            name="volume_per_bottle"
            label="Volume/frasco (ml)"
            required
            placeholder="100"
            keyboardType="decimal-pad"
            maxLength={10}
            value={state.volumePerBottle}
            onChange={(_n, raw) => state.setVolumePerBottle(parseDecimalPtBR(raw))}
          />
        </View>
      </View>
      <FormInput
        name="total_price"
        label="Preço total"
        placeholder="0,00"
        keyboardType="decimal-pad"
        maxLength={12}
        helperText={
          coerceDecimal(state.numBottles) > 0 && coerceDecimal(state.volumePerBottle) > 0
            ? `💧 Total: ${coerceDecimal(state.numBottles) * coerceDecimal(state.volumePerBottle)} ml`
            : 'R$ — opcional'
        }
        value={state.totalPrice}
        onChange={(_n, raw) => state.setTotalPrice(parseDecimalPtBR(raw))}
      />
    </FormSection>
  )
}

function renderStandardInputs(state) {
  return (
    <FormSection title="Quantidade e preço">
      <View style={styles.row}>
        <View style={styles.rowHalf}>
          <FormInput
            name="quantity"
            label={state.isLiquid ? 'Quantidade (ml)' : 'Quantidade (un.)'}
            required
            placeholder="0"
            keyboardType="decimal-pad"
            maxLength={10}
            disabled={state.isEdit}
            helperText={state.quantityHelperText}
            value={
              state.form.values.quantity != null ? String(state.form.values.quantity) : ''
            }
            error={state.form.touched.quantity ? state.form.errors.quantity : undefined}
            onChange={state.handleQuantityChange}
            onBlur={() => state.form.handleBlur('quantity', coerceDecimal(state.form.values.quantity))}
          />
        </View>
        <View style={styles.rowHalf}>
          <FormInput
            name="unit_price"
            label={state.isLiquid ? 'Preço por ml' : 'Preço unitário'}
            placeholder="0,00"
            keyboardType="decimal-pad"
            maxLength={12}
            helperText="R$ — opcional"
            value={
              state.form.values.unit_price != null ? String(state.form.values.unit_price) : ''
            }
            error={state.form.touched.unit_price ? state.form.errors.unit_price : undefined}
            onChange={state.handlePriceChange}
            onBlur={() => state.form.handleBlur('unit_price', coerceDecimal(state.form.values.unit_price))}
          />
        </View>
      </View>
    </FormSection>
  )
}

function renderDetailsSection(state) {
  return (
    <FormSection title="Detalhes">
      <FormInput
        name="pharmacy"
        label="Farmácia"
        placeholder="Onde você comprou?"
        helperText="Opcional"
        autoCapitalize="words"
        maxLength={200}
        {...formProps(state.form, 'pharmacy')}
      />
      <FormInput
        name="laboratory"
        label="Laboratório"
        placeholder="Laboratório"
        helperText={state.labLocked ? 'Marca registrada — definida pelo medicamento' : 'Opcional'}
        autoCapitalize="words"
        maxLength={200}
        disabled={state.labLocked}
        {...formProps(state.form, 'laboratory')}
      />
      <FormInput
        name="notes"
        label="Observações"
        placeholder="Notas sobre essa compra…"
        helperText="Opcional"
        multiline
        numberOfLines={3}
        maxLength={500}
        {...formProps(state.form, 'notes')}
      />
    </FormSection>
  )
}

export default function PurchaseFormScreen() {
  const route = useRoute()
  const navigation = useNavigation()
  const state = usePurchaseForm(route, navigation)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={state.goBack}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>{state.screenTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* PO-3: Medicamento travado — row read-only no topo */}
          <FormSection title="Medicamento">
            <View style={styles.medicineRow}>
              <View style={styles.medicineIcon}>
                <Package size={18} color={colors.primary[700]} strokeWidth={2} />
              </View>
              <View style={styles.medicineInfo}>
                <Text style={styles.medicineName} numberOfLines={2}>
                  {state.medicineName ?? '—'}
                </Text>
                <Text style={styles.medicineLocked}>Medicamento selecionado</Text>
              </View>
            </View>
          </FormSection>

          {/* Quantidade e preço */}
          {state.useLiquidInputs ? renderLiquidInputs(state) : renderStandardInputs(state)}

          {/* Apresentação do injetável */}
          {state.needsContainer && (
            <FormSection title="Apresentação">
              <FormSelect
                name="injection_container"
                label="Como vem embalado"
                value={state.injectionContainer}
                options={[
                  { value: '', label: 'Selecione (opcional)' },
                  ...INJECTION_CONTAINERS.map((c) => ({ value: c, label: INJECTION_CONTAINER_LABELS[c] })),
                ]}
                onChange={(_n, v) => state.setInjectionContainer(v)}
                helperText="Ex.: caneta, ampola — usado para mostrar quantas aplicações restam."
              />
            </FormSection>
          )}

          {/* Datas */}
          <FormSection title="Datas">
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <FormDatePicker
                  name="purchase_date"
                  label="Data da compra"
                  required
                  placeholder="Selecionar data"
                  value={state.purchaseDateObj}
                  error={
                    state.form.touched.purchase_date ? state.form.errors.purchase_date : undefined
                  }
                  onChange={state.handlePurchaseDateChange}
                  onBlur={state.form.handleBlur}
                  maximumDate={getNow()}
                />
              </View>
              <View style={styles.rowHalf}>
                <FormDatePicker
                  name="expiration_date"
                  label="Validade"
                  placeholder="MM/AAAA"
                  helperText="Opcional"
                  value={state.expirationDateObj}
                  error={
                    state.form.touched.expiration_date
                      ? state.form.errors.expiration_date
                      : undefined
                  }
                  onChange={state.handleExpirationDateChange}
                  onBlur={state.form.handleBlur}
                  minimumDate={state.purchaseDateObj || undefined}
                />
              </View>
            </View>
          </FormSection>

          {/* Detalhes */}
          {renderDetailsSection(state)}
        </ScrollView>

        {/* Sticky save bar */}
        <FormActions
          primaryLabel={state.ctaLabel}
          onPrimary={state.handleSubmit}
          primaryLoading={state.isLoading}
          secondaryLabel="Cancelar"
          onSecondary={state.goBack}
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
  // Medicamento travado (PO-3)
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bg.screen,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  medicineIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full ?? 99,
    backgroundColor: colors.primary[50] ?? colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  medicineLocked: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.muted,
    marginTop: 2,
  },
  // Linha de dois campos lado a lado
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  rowHalf: {
    flex: 1,
  },
})
