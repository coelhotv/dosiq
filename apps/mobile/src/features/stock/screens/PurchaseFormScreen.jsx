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

// eslint-disable-next-line max-lines-per-function
export default function PurchaseFormScreen() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const route = useRoute()
  const [labLocked, setLabLocked] = useState(false)
  const [medicine, setMedicine] = useState(null)
  // Líquidos (022): estoque em ml. Estados locais (fora do schema) p/ frascos/volume/preço total.
  const [numBottles, setNumBottles] = useState('')
  const [volumePerBottle, setVolumePerBottle] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  // 012 Fase B4 (ADR-068): apresentação do LOTE. No edit, prefill do lote editado
  // (route.params.purchase) — lazy init evita set-state-in-effect (AP-222).
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
  // Líquido := dosage_unit do medicamento termina em '/ml' (decisão-mãe 022).
  const isLiquid = Boolean(medicine?.dosage_unit?.endsWith('/ml'))
  // Frascos/ml só no create (edit ajusta saldo em ml direto).
  const useLiquidInputs = isLiquid && !isEdit
  // 012 Fase B4 (ADR-068): apresentação é atributo do LOTE → pergunta em TODA compra
  // de injetável (create e edit). Grava em stock+purchases via RPC, não no medicine.
  const isInjectable = medicine?.presentation === 'injetavel'
  const needsContainer = isInjectable

  // Memos — valores iniciais do form
  // FormDatePicker recebe Date; schema armazena string YYYY-MM-DD.
  // Campos numéricos convertidos para string (FormInput só aceita string — ver MedicineFormScreen).
  const todayIso = useMemo(() => getTodayLocal(), [])

  const initialValues = useMemo(() => {
    if (isEdit && purchase) {
      return {
        quantity: (() => {
          // purchase vem da tabela (quantity_bought) ou do demo (quantity)
          const q = purchase.quantity_bought ?? purchase.quantity
          return q != null ? String(q).replace('.', ',') : ''
        })(),
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
  }, [isEdit, purchase, todayIso])

  const form = useFormState(stockCreateSchema, { initialValues })
  const { createPurchase, createLiquidPurchase, updatePurchase, isLoading } = useStockMutation()
  const { handleChange } = form

  // Derivados para FormDatePicker (converte string → Date para exibição)
  const purchaseDateObj = useMemo(
    () =>
      form.values.purchase_date
        ? parseLocalDate(form.values.purchase_date)
        : null,
    [form.values.purchase_date]
  )

  const expirationDateObj = useMemo(
    () =>
      form.values.expiration_date
        ? parseLocalDate(form.values.expiration_date)
        : null,
    [form.values.expiration_date]
  )

  const quantityHelperText = useMemo(() => {
    if (isEdit) {
      return 'Corrija o saldo pelo "Acertar saldo"'
    }
    if (!medicine) return undefined
    const shortHint = formatActiveIngredientShort(
      form.values.quantity,
      medicine.dosage_per_pill,
      medicine.dosage_unit
    )
    return shortHint ? `✨ Equivale a ${shortHint} no total` : undefined
  }, [isEdit, form.values.quantity, medicine])

  // Effects — busca categoria regulatória do medicamento. Se Novo/Similar, o
  // laboratório é marca registrada (não muda por compra): preenche + trava.
  // setState ocorre dentro do .then (microtask, não sync no corpo do effect),
  // então não dispara react-hooks/set-state-in-effect.
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

  // Handlers

  // Decimal PT-BR para quantidade (AP-167)
  const handleQuantityChange = useCallback(
    (_name, raw) => {
      form.handleChange('quantity', parseDecimalPtBR(raw))
    },
    [form]
  )

  // Decimal PT-BR para preço unitário (AP-167)
  const handlePriceChange = useCallback(
    (_name, raw) => {
      form.handleChange('unit_price', parseDecimalPtBR(raw))
    },
    [form]
  )

  // FormDatePicker entrega Date → converte para string YYYY-MM-DD
  const handlePurchaseDateChange = useCallback(
    (_name, date) => form.handleChange('purchase_date', date ? formatLocalDate(date) : todayIso),
    [form, todayIso]
  )

  const handleExpirationDateChange = useCallback(
    (_name, date) => form.handleChange('expiration_date', date ? formatLocalDate(date) : null),
    [form]
  )

  const handleSubmit = useCallback(async () => {
    // AP-166: overrides para coerce de decimais antes do safeParse (evita race)
    let quantityCoerced
    let priceCoerced

    if (useLiquidInputs) {
      // Líquido: quantity (ml) = frascos × volume; preço por ml = total / ml (trunc 4 casas).
      const bottles = coerceDecimal(numBottles)
      const volume = coerceDecimal(volumePerBottle)
      if (!bottles || bottles <= 0 || !volume || volume <= 0) {
        Alert.alert('Verifique o formulário', 'Informe o número de frascos e o volume por frasco (ml).')
        return
      }
      quantityCoerced = bottles * volume
      const total = coerceDecimal(totalPrice)
      priceCoerced =
        total && total > 0 && quantityCoerced > 0
          ? Math.floor((total / quantityCoerced) * 10000) / 10000
          : undefined
    } else {
      quantityCoerced = coerceDecimal(form.values.quantity)
      priceCoerced = coerceDecimal(form.values.unit_price)
    }

    const overrides = {
      medicine_id: medicineId,
      quantity: quantityCoerced,
      unit_price: priceCoerced !== undefined ? priceCoerced : undefined,
    }

    if (!form.validate(overrides)) {
      // Anti-silent-no-op (smoke iOS 022): feedback sempre.
      const parsed = stockCreateSchema.safeParse({ ...form.values, ...overrides })
      const firstError = parsed.success ? null : parsed.error.issues[0]?.message
      Alert.alert('Verifique o formulário', firstError || 'Há campos obrigatórios não preenchidos.')
      return
    }

    const payload = {
      medicine_id: medicineId,
      quantity: quantityCoerced,
      purchase_date: form.values.purchase_date,
      expiration_date: form.values.expiration_date || null,
      unit_price: priceCoerced !== undefined ? priceCoerced : undefined,
      pharmacy: form.values.pharmacy || null,
      laboratory: form.values.laboratory || null,
      notes: form.values.notes || null,
      // ADR-068: apresentação vai no LOTE (stock+purchases via RPC). Só p/ injetável.
      injection_container: isInjectable ? injectionContainer || null : null,
    }

    if (isEdit) {
      await updatePurchase(purchaseId, payload, { goBack: true })
    } else if (useLiquidInputs) {
      // 012 B4 (ADR-068/022): líquido com X frascos → X lotes (split + custo dividido).
      // FIFO consome lote a lote; opened_at só na 1ª dose de cada lote.
      await createLiquidPurchase(
        {
          medicineId,
          numBottles: Math.trunc(coerceDecimal(numBottles)),
          volumePerBottle: coerceDecimal(volumePerBottle),
          totalPrice: coerceDecimal(totalPrice) || 0,
          purchaseDate: form.values.purchase_date,
          expirationDate: form.values.expiration_date || null,
          pharmacy: form.values.pharmacy || null,
          laboratory: form.values.laboratory || null,
          notes: form.values.notes || null,
          injectionContainer: isInjectable ? injectionContainer || null : null,
        },
        { goBack: true },
      )
    } else {
      await createPurchase(payload, { goBack: true })
    }
  }, [form, isEdit, medicineId, purchaseId, createPurchase, createLiquidPurchase, updatePurchase, useLiquidInputs, numBottles, volumePerBottle, totalPrice, isInjectable, injectionContainer])

  const goBack = useCallback(() => navigation.goBack(), [navigation])

  const screenTitle = isEdit ? 'Editar compra' : 'Registrar compra'
  const ctaLabel = isEdit ? 'Salvar alterações' : 'Registrar compra'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>{screenTitle}</Text>
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
                  {medicineName ?? '—'}
                </Text>
                <Text style={styles.medicineLocked}>Medicamento selecionado</Text>
              </View>
            </View>
          </FormSection>

          {/* Quantidade e preço (ADR-046: unidade no label) */}
          {useLiquidInputs ? (
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
                    value={numBottles}
                    onChange={(_n, raw) => setNumBottles(parseDecimalPtBR(raw))}
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
                    value={volumePerBottle}
                    onChange={(_n, raw) => setVolumePerBottle(parseDecimalPtBR(raw))}
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
                  coerceDecimal(numBottles) > 0 && coerceDecimal(volumePerBottle) > 0
                    ? `💧 Total: ${coerceDecimal(numBottles) * coerceDecimal(volumePerBottle)} ml`
                    : 'R$ — opcional'
                }
                value={totalPrice}
                onChange={(_n, raw) => setTotalPrice(parseDecimalPtBR(raw))}
              />
            </FormSection>
          ) : (
            <FormSection title="Quantidade e preço">
              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <FormInput
                    name="quantity"
                    label={isLiquid ? 'Quantidade (ml)' : 'Quantidade (un.)'}
                    required
                    placeholder="0"
                    keyboardType="decimal-pad"
                    maxLength={10}
                    disabled={isEdit}
                    helperText={quantityHelperText}
                    value={
                      form.values.quantity != null ? String(form.values.quantity) : ''
                    }
                    error={form.touched.quantity ? form.errors.quantity : undefined}
                    onChange={handleQuantityChange}
                    onBlur={() => form.handleBlur('quantity', coerceDecimal(form.values.quantity))}
                  />
                </View>
                <View style={styles.rowHalf}>
                  <FormInput
                    name="unit_price"
                    label={isLiquid ? 'Preço por ml' : 'Preço unitário'}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    maxLength={12}
                    helperText="R$ — opcional"
                    value={
                      form.values.unit_price != null ? String(form.values.unit_price) : ''
                    }
                    error={form.touched.unit_price ? form.errors.unit_price : undefined}
                    onChange={handlePriceChange}
                    onBlur={() => form.handleBlur('unit_price', coerceDecimal(form.values.unit_price))}
                  />
                </View>
              </View>
            </FormSection>
          )}

          {/* 012 Fase B2 (FR-019): apresentação física do injetável (captura/correção). */}
          {needsContainer && (
            <FormSection title="Apresentação">
              <FormSelect
                name="injection_container"
                label="Como vem embalado"
                value={injectionContainer}
                options={[
                  { value: '', label: 'Selecione (opcional)' },
                  ...INJECTION_CONTAINERS.map((c) => ({ value: c, label: INJECTION_CONTAINER_LABELS[c] })),
                ]}
                onChange={(_n, v) => setInjectionContainer(v)}
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
                  value={purchaseDateObj}
                  error={
                    form.touched.purchase_date ? form.errors.purchase_date : undefined
                  }
                  onChange={handlePurchaseDateChange}
                  onBlur={form.handleBlur}
                  maximumDate={getNow()}
                />
              </View>
              <View style={styles.rowHalf}>
                <FormDatePicker
                  name="expiration_date"
                  label="Validade"
                  placeholder="MM/AAAA"
                  helperText="Opcional"
                  value={expirationDateObj}
                  error={
                    form.touched.expiration_date
                      ? form.errors.expiration_date
                      : undefined
                  }
                  onChange={handleExpirationDateChange}
                  onBlur={form.handleBlur}
                  minimumDate={purchaseDateObj || undefined}
                />
              </View>
            </View>
          </FormSection>

          {/* Detalhes */}
          <FormSection title="Detalhes">
            <FormInput
              name="pharmacy"
              label="Farmácia"
              placeholder="Onde você comprou?"
              helperText="Opcional"
              autoCapitalize="words"
              maxLength={200}
              {...formProps(form, 'pharmacy')}
            />
            <FormInput
              name="laboratory"
              label="Laboratório"
              placeholder="Laboratório"
              helperText={labLocked ? 'Marca registrada — definida pelo medicamento' : 'Opcional'}
              autoCapitalize="words"
              maxLength={200}
              disabled={labLocked}
              {...formProps(form, 'laboratory')}
            />
            <FormInput
              name="notes"
              label="Observações"
              placeholder="Notas sobre essa compra…"
              helperText="Opcional"
              multiline
              numberOfLines={3}
              maxLength={500}
              {...formProps(form, 'notes')}
            />
          </FormSection>
        </ScrollView>

        {/* Sticky save bar */}
        <FormActions
          primaryLabel={ctaLabel}
          onPrimary={handleSubmit}
          primaryLoading={isLoading}
          secondaryLabel="Cancelar"
          onSecondary={goBack}
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
