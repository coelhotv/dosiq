// StockAdjustmentScreen.jsx — tela "Acertar saldo" (PO-6, S2.2 Fase 3).
//
// Modo ÚNICO "Acertar saldo": usuário digita o saldo final desejado (newBalance,
// inteiro >= 0, un.). O delta (newBalance - currentBalance) é calculado e mostrado
// no preview "APÓS AJUSTE". NÃO há segmented control +/− (PO-6).
//
// route.params: { medicineId, medicineName, currentBalance }
//   currentBalance pode vir do StockDetail; se ausente, busca via getTotalQuantity.
//
// Contratos:
//   useStockMutation().adjustBalance(medicineId, newBalance, reason, notes)
//     → Promise<{delta, before, after}>; já dá toast e lança em erro.
//   stockService.getTotalQuantity(medicineId) → number (userId resolvido na factory G2).
//   useAuth() → user?.id.
//
// R-010: States → Memos → Effects → Handlers
// ADR-028: StyleSheet. ADR-023: fontWeights >= 400. ADR-046: unidade(s) no texto.

import { useCallback, useMemo, useState } from 'react'
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
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'
import { ChevronLeft, Package } from 'lucide-react-native'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormSection from '@shared/components/form/FormSection'
import FormActions from '@shared/components/form/FormActions'
import { useStockMutation } from '@stock/hooks/useStockMutation'
import { stockService } from '@stock/services/stockService'
import { medicineService } from '@medications/services/medicineService'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { formatConcentration, isLiquidMedicine, formatNumberPtBR } from '@dosiq/core'
import { colors, spacing, typography, borderRadius } from '@shared/styles/tokens'

// Motivos de ajuste — value enviado ao service, label exibido no dropdown.
const REASON_OPTIONS = [
  { value: 'perda', label: 'Perda' },
  { value: 'doacao', label: 'Doação a terceiros' },
  { value: 'descarte', label: 'Descarte' },
  { value: 'vencimento_manual', label: 'Vencimento' },
  { value: 'correcao_erro', label: 'Correção de erro' },
  { value: 'outro', label: 'Outro' },
]

// Sólido: apenas dígitos (saldo inteiro de unidades).
function sanitizeInt(raw) {
  return String(raw ?? '').replace(/[^0-9]/g, '')
}

// Líquido (022): saldo em ml aceita decimal PT-BR (vírgula). Normaliza ponto → vírgula.
function sanitizeDecimal(raw) {
  return String(raw ?? '')
    .replace('.', ',')
    .replace(/[^0-9,]/g, '')
    .replace(/(,.*),/g, '$1') // só uma vírgula
}

export default function StockAdjustmentScreen() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const route = useRoute()
  const { user } = useAuth()
  const { adjustBalance } = useStockMutation()

  const { medicineId, medicineName, currentBalance: paramBalance } = route.params ?? {}

  const [currentBalance, setCurrentBalance] = useState(
    typeof paramBalance === 'number' ? paramBalance : null,
  )
  const [medicine, setMedicine] = useState(null)
  const [newBalance, setNewBalance] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Memos
  // Líquido (022): saldo em ml (decimal). Sólido: unidades inteiras.
  const isLiquid = isLiquidMedicine(medicine)

  const parsedNew = useMemo(() => {
    if (newBalance === '') return null
    const n = Number(String(newBalance).replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }, [newBalance])

  const delta = useMemo(() => {
    if (parsedNew == null || currentBalance == null) return null
    return parsedNew - currentBalance
  }, [parsedNew, currentBalance])

  const canConfirm = useMemo(
    () =>
      !submitting &&
      currentBalance != null &&
      parsedNew != null &&
      parsedNew >= 0 &&
      delta !== 0 &&
      reason !== '',
    [submitting, currentBalance, parsedNew, delta, reason],
  )

  // Effects — busca medicine (dose pill da ficha) sempre + saldo atual se não
  // veio por param. NÃO depende de `currentBalance` (evita re-execução quando o
  // saldo é setado); `needsBalance` deriva do param (estável). Callback sync;
  // setState no .then = microtask (não dispara set-state-in-effect).
  const needsBalance = typeof paramBalance !== 'number'
  useFocusEffect(
    useCallback(() => {
      const userId = user?.id
      if (!medicineId || !userId) return
      let cancelled = false
      medicineService
        .getById(medicineId)
        .then((med) => { if (!cancelled && med) setMedicine(med) })
        .catch(() => {})
      if (needsBalance) {
        stockService
          .getTotalQuantity(medicineId, userId)
          .then((total) => {
            if (!cancelled && typeof total === 'number') setCurrentBalance(total)
          })
          .catch(() => {})
      }
      return () => {
        cancelled = true
      }
    }, [medicineId, user, needsBalance]),
  )

  // Handlers
  const handleNewBalanceChange = useCallback((_name, raw) => {
    setNewBalance(isLiquid ? sanitizeDecimal(raw) : sanitizeInt(raw))
  }, [isLiquid])

  const handleReasonChange = useCallback((_name, value) => {
    setReason(value)
  }, [])

  const handleNotesChange = useCallback((_name, value) => {
    setNotes(value)
  }, [])

  const goBack = useCallback(() => navigation.goBack(), [navigation])

  const handleConfirm = useCallback(async () => {
    if (parsedNew == null || parsedNew < 0 || delta === 0 || reason === '') return
    setSubmitting(true)
    try {
      await adjustBalance(medicineId, Number(parsedNew), reason, notes || null)
      navigation.goBack()
    } catch {
      // Hook já mostrou toast de erro; mantém usuário na tela para corrigir.
    } finally {
      setSubmitting(false)
    }
  }, [parsedNew, delta, reason, notes, adjustBalance, medicineId, navigation])

  // Dose pill da ficha (sempre que houver medicine com dosagem).
  const dosePill =
    medicine?.dosage_per_pill != null
      ? formatConcentration(medicine.dosage_per_pill, medicine.dosage_unit, medicine.concentration_volume_ml)
      : null

  // Preview "APÓS AJUSTE" — cor do delta: verde se positivo, vermelho se negativo.
  const unitSuffix = isLiquid ? 'ml' : 'un.'
  const fmtBal = (n) => (isLiquid ? formatNumberPtBR(n) : String(n))
  const deltaPositive = delta != null && delta > 0
  const deltaLabel =
    delta != null ? `(${delta > 0 ? '+' : ''}${fmtBal(delta)})` : ''

  // Texto do saldo atual (extraído p/ reduzir complexidade do JSX).
  let saldoAtualText = 'Calculando saldo…'
  if (currentBalance != null) {
    saldoAtualText = isLiquid
      ? `Saldo atual: ${formatNumberPtBR(currentBalance)} ml`
      : `Saldo atual: ${currentBalance} ${currentBalance === 1 ? 'unidade' : 'unidades'}`
  }

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
        <Text style={styles.title}>Ajustar saldo</Text>
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
          {/* Card de contexto — medicamento + saldo atual */}
          <View style={styles.contextCard}>
            <View style={styles.contextIcon}>
              <Package size={18} color={colors.primary[700]} strokeWidth={2} />
            </View>
            <View style={styles.contextInfo}>
              <View style={styles.contextNameRow}>
                <Text style={styles.contextName} numberOfLines={2}>
                  {medicine?.name ?? medicineName ?? '—'}
                </Text>
                {dosePill ? (
                  <View style={styles.dosePill}>
                    <Text style={styles.dosePillText}>{dosePill}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.contextBalance}>{saldoAtualText}</Text>
            </View>
          </View>

          {/* Novo saldo */}
          <FormSection title="Ajuste">
            <FormInput
              name="newBalance"
              label={isLiquid ? 'Novo saldo (ml)' : 'Novo saldo (un.)'}
              required
              placeholder={currentBalance != null ? String(currentBalance) : '0'}
              keyboardType={isLiquid ? 'decimal-pad' : 'number-pad'}
              maxLength={isLiquid ? 10 : 6}
              value={newBalance}
              onChange={handleNewBalanceChange}
              helperText={isLiquid ? 'Informe o saldo final desejado em ml' : 'Informe o saldo final desejado em unidades'}
            />

            {/* Preview APÓS AJUSTE */}
            {delta != null && (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>APÓS AJUSTE</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewFrom}>{fmtBal(currentBalance)}</Text>
                  <Text style={styles.previewArrow}> → </Text>
                  <Text style={styles.previewTo}>{fmtBal(parsedNew)} {unitSuffix}</Text>
                  {delta !== 0 && (
                    <Text
                      style={[
                        styles.previewDelta,
                        {
                          color: deltaPositive
                            ? colors.status.success
                            : colors.status.error,
                        },
                      ]}
                    >
                      {' '}
                      {deltaLabel}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Motivo (obrigatório) */}
            <FormSelect
              name="reason"
              label="Motivo"
              required
              placeholder="Selecionar motivo"
              options={REASON_OPTIONS}
              value={reason}
              onChange={handleReasonChange}
            />

            {/* Observações (opcional) */}
            <FormInput
              name="notes"
              label="Observações"
              placeholder="Detalhes do ajuste…"
              helperText="Opcional"
              multiline
              numberOfLines={3}
              maxLength={500}
              value={notes}
              onChange={handleNotesChange}
            />
          </FormSection>
        </ScrollView>

        {/* Sticky footer */}
        <FormActions
          primaryLabel="Confirmar ajuste"
          onPrimary={handleConfirm}
          primaryDisabled={!canConfirm}
          primaryLoading={submitting}
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
  // Card de contexto
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.primary[50] ?? colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[6],
  },
  contextIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full ?? 99,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextInfo: {
    flex: 1,
  },
  contextNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  contextName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dosePill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.neutral[300],
  },
  dosePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  contextBalance: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
    marginTop: 2,
  },
  // Preview APÓS AJUSTE
  previewBox: {
    backgroundColor: colors.primary[50] ?? colors.bg.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text.muted,
    marginBottom: spacing[1],
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  previewFrom: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
  previewArrow: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.text.secondary,
  },
  previewTo: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  previewDelta: {
    fontSize: 14,
    fontWeight: '700',
  },
})
