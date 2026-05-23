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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { ChevronLeft, Package } from 'lucide-react-native'
import { stockCreateSchema, getTodayLocal, parseLocalDate, formatLocalDate, getNow } from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import FormInput from '@shared/components/form/FormInput'
import FormDatePicker from '@shared/components/form/FormDatePicker'
import FormSection from '@shared/components/form/FormSection'
import FormActions from '@shared/components/form/FormActions'
import { useStockMutation } from '@stock/hooks/useStockMutation'
import { medicineService } from '@medications/services/medicineService'
import { colors, spacing, typography, borderRadius } from '@shared/styles/tokens'

// Categorias regulatórias com marca registrada → laboratório fixo (não muda por compra).
const FIXED_LAB_CATEGORIES = ['Novo', 'Similar']

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

  const {
    mode = 'create',
    medicineId,
    medicineName,
    purchaseId,
    purchase,
  } = route.params ?? {}

  const isEdit = mode === 'edit'

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
  const { createPurchase, updatePurchase, isLoading } = useStockMutation()

  // States — laboratório travado p/ medicamentos de marca (Novo/Similar)
  const [labLocked, setLabLocked] = useState(false)

  // Effects — busca categoria regulatória do medicamento. Se Novo/Similar, o
  // laboratório é marca registrada (não muda por compra): preenche + trava.
  useEffect(() => {
    if (!medicineId) return
    let cancelled = false
    medicineService
      .getById(medicineId)
      .then((med) => {
        if (cancelled || !med) return
        if (FIXED_LAB_CATEGORIES.includes(med.regulatory_category) && med.laboratory) {
          form.handleChange('laboratory', med.laboratory)
          setLabLocked(true)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicineId])

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
    const quantityCoerced = coerceDecimal(form.values.quantity)
    const priceCoerced = coerceDecimal(form.values.unit_price)

    const overrides = {
      medicine_id: medicineId,
      quantity: quantityCoerced,
      unit_price: priceCoerced !== undefined ? priceCoerced : undefined,
    }

    if (!form.validate(overrides)) return

    const payload = {
      medicine_id: medicineId,
      quantity: quantityCoerced,
      purchase_date: form.values.purchase_date,
      expiration_date: form.values.expiration_date || null,
      unit_price: priceCoerced !== undefined ? priceCoerced : undefined,
      pharmacy: form.values.pharmacy || null,
      laboratory: form.values.laboratory || null,
      notes: form.values.notes || null,
    }

    if (isEdit) {
      await updatePurchase(purchaseId, payload, { goBack: true })
    } else {
      await createPurchase(payload, { goBack: true })
    }
  }, [form, isEdit, medicineId, purchaseId, createPurchase, updatePurchase])

  const goBack = useCallback(() => navigation.goBack(), [navigation])

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
          <FormSection title="Quantidade e preço">
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <FormInput
                  name="quantity"
                  label="Quantidade (un.)"
                  required
                  placeholder="0"
                  keyboardType="decimal-pad"
                  disabled={isEdit}
                  helperText={isEdit ? 'Corrija o saldo pelo "Acertar saldo"' : undefined}
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
                  label="Preço unitário"
                  placeholder="0,00"
                  keyboardType="decimal-pad"
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
              placeholder="Fabricante"
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
