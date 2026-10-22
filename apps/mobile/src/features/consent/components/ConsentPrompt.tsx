/**
 * ConsentPrompt — pedido de consentimento para quem NUNCA se manifestou (spec 046, T009).
 *
 * Alvo: contas anteriores ao 046 (estado `missing`). Não existe consentimento retroativo — inventar
 * um seria a fraude que a trilha existe para impedir. Então perguntamos.
 *
 * Duas formas, decididas pelo guard (`resolveConsentGate`), não por este componente:
 *   - dispensável (até 3 sessões): dá para adiar com "Agora não";
 *   - bloqueante (da 4ª em diante): o "Agora não" some.
 *
 * Adiar NÃO é um evento da trilha: `revoked` é a retirada de um consentimento que EXISTIU. Quem
 * nunca consentiu e adia segue `missing` — o botão de adiar não escreve nada no banco.
 *
 * Spec 107 (FR-010): se a conta está na fila de exclusão (legado/onboarding sem autorização), o
 * prompt mostra a DATA e o texto vindo do servidor (fallback embarcado se inválido/offline), e —
 * quando quem monta passa `onDeleteAccount` — a saída "excluir agora" (INV-5, imediata). Sem data,
 * nada muda. Revogado não passa por aqui (ConsentResolutionScreen).
 */
import { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { HEALTH_CONSENT_COPY, NEVER_CONSENTED_DEADLINE_COPY, renderDeadlineCopy, parseISO, formatDatePtBR } from '@dosiq/core'
import HealthConsentCheckbox from './HealthConsentCheckbox'
import ConsentLegalHeader from './ConsentLegalHeader'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { EXTERNAL_URLS } from '../../../shared/constants'
import { fetchDeletionNotice, type DeletionNotice } from '@platform/consent/deletionNoticeService'

// 065 PR D / US9 — de onde este prompt foi renderizado (4 call-sites reais, achados no C1.5;
// ConsentRegularizationSheet é aceite de política nova e usa componente PRÓPRIO, não este).
export type ConsentPromptSource =
  | 'prompt_blocking'      // Navigation.tsx — trava do guard (mode !== 'blocked_revoked')
  | 'prompt_dismissible'   // Navigation.tsx — overlay até a 3ª sessão
  | 'prompt_navigated'     // ConsentPromptScreen.tsx — opt-in voluntário via hub
  | 'resolution_revoked'   // ConsentResolutionScreen.tsx — re-consentir após revogação

interface ConsentPromptProps {
  blocking: boolean
  source: ConsentPromptSource
  onGrant: () => Promise<{ ok: boolean; error?: string }>
  onDismiss?: () => void
  onGranted: () => void
  /** 107: saída "excluir agora" — só onde a rota de exclusão existe (navigator travado). */
  onDeleteAccount?: () => void
}

/** Fontes em que a conta pode estar na fila (nunca consentiu). O opt-in voluntário e o revogado não. */
const DEADLINE_SOURCES: ConsentPromptSource[] = ['prompt_blocking', 'prompt_dismissible']

export default function ConsentPrompt({ blocking, source, onGrant, onDismiss, onGranted, onDeleteAccount }: ConsentPromptProps) {
  const [checked, setChecked] = useState(false)
  const [showError, setShowError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<DeletionNotice | null>(null)

  const deadlineText = notice
    ? renderDeadlineCopy(notice.body, formatDatePtBR(parseISO(notice.eligibleAt)) || '')
    : null

  // 1x por montagem (não por render) — mesma disciplina do FR-1: `source`/`blocking` vêm de quem
  // monta este componente, nunca de um default silencioso.
  useEffect(() => {
    void logEvent(EVENTS.CONSENT_PROMPT_SHOWN, { blocking, source, surface: SURFACES.MOBILE })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 107: prazo de exclusão (fail-open — sem resposta, o prompt é o de sempre). Sem cache.
  useEffect(() => {
    if (!DEADLINE_SOURCES.includes(source)) return
    let alive = true
    void fetchDeletionNotice().then((n) => {
      if (alive) setNotice(n)
    })
    return () => {
      alive = false
    }
  }, [source])

  function handleDismiss() {
    void logEvent(EVENTS.CONSENT_PROMPT_DISMISSED, { source, surface: SURFACES.MOBILE })
    onDismiss?.()
  }

  async function handleConfirm() {
    if (!checked) {
      setShowError(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await onGrant()
      if (!res.ok) {
        setError('Não foi possível registrar o consentimento agora. Tente de novo.')
        return
      }
      void logEvent(EVENTS.CONSENT_GRANTED, { source, surface: SURFACES.MOBILE })
      onGranted()
    } catch {
      // onGrant() rejeitou (ex.: rede) — sem isto o botão ficaria travado em loading.
      setError('Não foi possível registrar o consentimento agora. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    // edges top+bottom: o topo tira o título de baixo do notch/câmera; o bottom afasta os botões da
    // barra de gestos do Android (e do home indicator do iOS). Sem isto, esta tela desenha edge-to-edge.
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ConsentLegalHeader />
        <Text style={styles.title}>{deadlineText ? NEVER_CONSENTED_DEADLINE_COPY.title : HEALTH_CONSENT_COPY.title}</Text>
        {deadlineText ? (
          // Nó de texto puro: o conteúdo vem do servidor (S-5), nunca é interpretado como marcação.
          <Text style={styles.lead} testID="consent-deadline-text">{deadlineText}</Text>
        ) : (
          <Text style={styles.lead}>
            Para continuar usando o dosiq, precisamos da sua autorização para tratar os dados de saúde
            que fazem o app funcionar.
          </Text>
        )}

        <HealthConsentCheckbox
          checked={checked}
          onChange={(value) => {
            setChecked(value)
            if (value) setShowError(false)
          }}
          disabled={saving}
          showError={showError}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={[styles.confirm, saving && styles.disabled]}
          onPress={handleConfirm}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Autorizar e continuar"
        >
          {saving ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.confirmText}>Autorizar e continuar</Text>
          )}
        </Pressable>

        {/* C-B3-13: autorizar aqui também grava o aceite dos Termos e da Política (gate.grant). */}
        <Text style={styles.terms}>
          Ao continuar, você aceita os{' '}
          <Text style={styles.termsLink} accessibilityRole="link" onPress={() => void Linking.openURL(EXTERNAL_URLS.TERMS_OF_USE).catch(() => {})}>
            Termos de Uso
          </Text>{' '}
          e a{' '}
          <Text style={styles.termsLink} accessibilityRole="link" onPress={() => void Linking.openURL(EXTERNAL_URLS.PRIVACY_POLICY).catch(() => {})}>
            Política de Privacidade
          </Text>
          .
        </Text>

        {deadlineText && onDeleteAccount ? (
          <Pressable style={styles.dismiss} onPress={onDeleteAccount} disabled={saving} accessibilityRole="button">
            <Text style={styles.deleteText}>{NEVER_CONSENTED_DEADLINE_COPY.deleteNow}</Text>
          </Pressable>
        ) : null}

        {!blocking && onDismiss ? (
          <Pressable style={styles.dismiss} onPress={handleDismiss} disabled={saving} accessibilityRole="button">
            <Text style={styles.dismissText}>Agora não</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  terms: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.text.muted },
  termsLink: { color: colors.brand.primary, fontWeight: '600' },
  container: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  scroll: {
    padding: spacing[5],
    gap: spacing[4],
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  error: {
    color: colors.status.error,
    fontSize: 13,
  },
  actions: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[2],
  },
  confirm: {
    height: 54,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: typography.fontFamily.bold,
  },
  disabled: {
    opacity: 0.6,
  },
  dismiss: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: colors.status.error,
    fontSize: 14,
    fontWeight: '600',
  },
  dismissText: {
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
})
