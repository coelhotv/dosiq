// DoseWeightPrompt.tsx — passo 2 do sheet de dose: pedido de peso (spec 069 A2 · FR-001/FR-004..FR-019).
//
// Aparece DEPOIS de a dose estar salva (INV-1: nada aqui desfaz a dose). Recibo da dose no topo, em
// todos os estados — é ele que prova que a dose foi salva quando o peso falha (A-D2).
// Peso é MEDIDA: azul-info, nunca o teal da dose (A-D3). Opcional de verdade: teclado fechado ao
// entrar (A-D4), "Agora não" do mesmo tamanho de "Salvar peso" (A-D5, FR-016).
// SaMD (ADR-062): o último registro é fato — sem diferença, seta ou cor (A-D7).
//
// Fechamento sem botão (fundo / voltar do Android) chega pelo ref: `requestClose()` (analysis G-6).

import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { Check, Ruler, AlertCircle } = LucideIcons as any
import { coerceDecimal, parseISO, validateBiomarkerLog } from '@dosiq/core'
import MeasureValueFields from '@measures/components/MeasureValueFields'
import { measuresRepo } from '@measures/services/measuresRepo'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES, ENTRY_POINTS, PROMPT_DISMISS_REASONS } from '@platform/analytics/analyticsEvents'
import { useToast } from '@shared/components/feedback/Toast'
import { isNetworkError } from '@shared/utils/networkError'
import { clientUuid } from '@shared/utils/clientUuid'
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { markPromptPeriod, type PostDoseStep } from '../services/measurePrompt'

const UNIT = 'kg'
// Teto da gravação (mesmo valor do useMutation — R-168). Rede com perda total faz o iOS esperar ~60 s.
const SAVE_TIMEOUT_MS = 15_000

class SaveTimeoutError extends Error {}

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new SaveTimeoutError('timeout')), ms) })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function formatKg(value) {
  return Number(value).toFixed(1).replace('.', ',')
}

function formatDayMonth(iso) {
  const d = parseISO(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastMeasureCaption(lastMeasure) {
  if (!lastMeasure || !Number.isFinite(lastMeasure.value)) return 'Agora'
  return `Agora · último: ${formatKg(lastMeasure.value)} kg em ${formatDayMonth(lastMeasure.measuredAt)}`
}

/**
 * @param step        PostDoseStep de resolvePostDoseStep (política, chave do período, último peso)
 * @param receipt     { title, detail } do recibo da dose
 * @param trigger     'single' | 'bulk'
 * @param treatmentId só no single (protocolo da dose aberta — R-299)
 * @param entryPoint  'reminder' quando o sheet foi aberto por lembrete (065 AD-8)
 * @param onFinished  chamado 1× ao fechar por qualquer caminho — o modal então chama o onSuccess
 */
export type DoseWeightPromptHandle = { requestClose: () => void }

type DoseWeightPromptProps = {
  step: PostDoseStep
  receipt: { title: string; detail?: string }
  trigger: 'single' | 'bulk'
  treatmentId?: string | null
  entryPoint?: string | null
  onFinished: () => void
}

const DoseWeightPrompt = forwardRef<DoseWeightPromptHandle, DoseWeightPromptProps>(function DoseWeightPrompt(
  { step, receipt, trigger, treatmentId = null, entryPoint = null, onFinished },
  ref
) {
  // States
  const [value, setValue] = useState('')
  const [phase, setPhase] = useState('idle') // idle | saving | error
  const [failure, setFailure] = useState(null) // 'network' | 'other'
  const [invalidMsg, setInvalidMsg] = useState(null)
  // Chave de idempotência: a MESMA em toda tentativa deste passo 2 — o retry de uma gravação que
  // chegou ao banco mas perdeu a resposta bate na PK e o core devolve a linha (sem duplicar).
  const [recordId] = useState(() => clientUuid())
  const { isOnline } = useOnlineStatus()
  const shownRef = useRef(false)
  const finishedRef = useRef(false)
  const { show } = useToast()

  const biomarkerType = step.policy.biomarkerType
  const baseProps = { biomarker_type: biomarkerType, trigger, surface: SURFACES.MOBILE }

  // Effects — shown 1× por montagem do passo (denominador do funil)
  useEffect(() => {
    if (shownRef.current) return
    shownRef.current = true
    void logEvent(EVENTS.MEASURE_PROMPT_SHOWN, {
      ...baseProps,
      ...(trigger === 'single' && treatmentId ? { treatment_id: treatmentId } : {}),
      ...(entryPoint ? { entry_point: entryPoint } : {}),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handlers
  function finish() {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinished()
  }

  function dismiss(reason) {
    if (phase === 'saving') return
    // "Fechar sem peso" (e fechar sem botão no erro) NÃO marca a semana (P2)
    if (reason !== PROMPT_DISMISS_REASONS.CLOSE_AFTER_ERROR) void markPromptPeriod(step)
    void logEvent(EVENTS.MEASURE_PROMPT_DISMISSED, { ...baseProps, reason })
    finish()
  }

  useImperativeHandle(ref, () => ({
    requestClose() {
      dismiss(phase === 'error' ? PROMPT_DISMISS_REASONS.CLOSE_AFTER_ERROR : PROMPT_DISMISS_REASONS.SWIPE)
    },
  }))

  function handleChange(text) {
    setValue(text)
    if (invalidMsg) setInvalidMsg(null)
  }

  async function handleSave() {
    if (phase === 'saving') return
    const num = coerceDecimal(value)
    // Faixa e positividade vêm do Zod do core (FR-017) — a UI só mostra a mensagem dele.
    const check = validateBiomarkerLog({ type: biomarkerType, value: num, unit: UNIT })
    if (!check.success) {
      const msg = check.errors?.find((e) => e.field === 'value')?.message
      setInvalidMsg(msg || 'Digite um valor válido maior que zero.')
      return
    }
    // Camada 1: offline já conhecido → nem tenta (nada sai do aparelho, nada a duplicar)
    if (!isOnline) {
      setFailure('network')
      setPhase('error')
      return
    }
    setPhase('saving')
    setFailure(null)
    try {
      // Camada 2: teto de 15 s. Estourar NÃO cancela o insert — por isso o id fixo acima.
      await withTimeout(
        measuresRepo.create({ id: recordId, type: biomarkerType, value: num, unit: UNIT }, { entry_point: ENTRY_POINTS.DOSE_PROMPT }),
        SAVE_TIMEOUT_MS
      )
    } catch (err) {
      setFailure(err instanceof SaveTimeoutError || isNetworkError(err) ? 'network' : 'other')
      setPhase('error')
      return
    }
    // Salvar NÃO marca a semana (R-15, PO 02/10): o peso gravado já suprime pela recência de 7 dias
    // (lida do banco a cada dose). Apagar o peso — digitado errado — reabre o pedido sem mexer na marca.
    show('Peso registrado', { variant: 'success' })
    finish()
  }

  const saving = phase === 'saving'
  const isError = phase === 'error'
  const canSave = value.trim() !== '' && !saving

  return (
    <View style={styles.root}>
      <View style={styles.receipt}>
        <View style={styles.receiptIcon}>
          <Check size={22} color={colors.text.inverse} strokeWidth={3} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.receiptTitle}>{receipt.title}</Text>
          {receipt.detail ? <Text style={styles.receiptDetail}>{receipt.detail}</Text> : null}
        </View>
      </View>

      <View style={styles.askRow}>
        <View style={styles.askIcon}>
          <Ruler size={20} color={colors.status.info} strokeWidth={2} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.askTitle}>Registrar o peso de hoje?</Text>
          <Text style={styles.askHint}>Opcional</Text>
        </View>
      </View>

      <View style={[styles.field, invalidMsg && styles.fieldInvalid]}>
        <MeasureValueFields
          unit={UNIT}
          isPa={false}
          value={value}
          onChangeValue={handleChange}
          valueSec=""
          onChangeValueSec={() => {}}
          errorMsg={invalidMsg}
          autoFocus={false}
        />
      </View>
      {!invalidMsg && <Text style={styles.caption}>{lastMeasureCaption(step.lastMeasure)}</Text>}

      {isError && (
        <View style={styles.banner} accessibilityRole="alert">
          <AlertCircle size={20} color={colors.status.error} strokeWidth={2} />
          <View style={styles.flex}>
            <Text style={styles.bannerTitle}>O peso não foi salvo</Text>
            <Text style={styles.bannerBody}>
              {failure === 'network' ? 'Sem internet. A dose está salva.' : 'Tente de novo. A dose está salva.'}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.btn, styles.btnNeutral, saving && styles.btnDisabled]}
          onPress={() => dismiss(isError ? PROMPT_DISMISS_REASONS.CLOSE_AFTER_ERROR : PROMPT_DISMISS_REASONS.SKIP)}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.btnNeutralText}>{isError ? 'Fechar sem peso' : 'Agora não'}</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnMeasure, !canSave && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={styles.btnMeasureText}>{saving ? 'Salvando…' : isError ? 'Tentar de novo' : 'Salvar peso'}</Text>
        </Pressable>
      </View>
    </View>
  )
})

export default DoseWeightPrompt

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  flex: { flex: 1 },
  receipt: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingBottom: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  receiptIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  receiptTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  receiptDetail: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] },
  askIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.status.infoLight,
    alignItems: 'center', justifyContent: 'center',
  },
  askTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  askHint: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  field: {
    borderWidth: 2, borderColor: colors.border.default, borderRadius: borderRadius.lg,
    paddingVertical: spacing[2], justifyContent: 'center',
  },
  fieldInvalid: { borderColor: colors.status.error },
  caption: { fontSize: 13, color: colors.text.muted, textAlign: 'center', minHeight: 20 },
  banner: {
    flexDirection: 'row', gap: spacing[3], backgroundColor: colors.status.errorLight,
    borderRadius: borderRadius.md, padding: spacing[3],
  },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: colors.status.error },
  bannerBody: { fontSize: 14, color: colors.status.error, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  btn: {
    flex: 1, minHeight: 52, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  btnNeutral: { borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: colors.bg.card },
  btnNeutralText: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  btnMeasure: { backgroundColor: colors.status.info },
  btnMeasureText: { fontSize: 15, fontWeight: '700', color: colors.text.inverse },
  btnDisabled: { opacity: 0.5 },
})
