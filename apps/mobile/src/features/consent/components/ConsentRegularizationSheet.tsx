// ConsentRegularizationSheet.tsx — reconsentimento da v0.4 (spec 096 `dq1a`; era o nudge da 046 T011).
// Espelha TzIntentSheet (R-233: statusBarTranslucent + spacer Android) e o ConsentRegularizationModal web.
//
// Alvo: titular que consentiu numa versão ANTIGA (`stale`). BLOQUEANTE (DQ-1, PO 20/10): sem "Agora
// não", sem fechar pelo fundo nem pelo voltar do Android — a v0.4 troca o responsável pelos dados e o
// titular decide: Confirmar (A obrigatória + B opcional, num gesto, + Termos no rodapé) ou Não concordo
// (→ retirada existente, em Privacidade e dados). Sem o antigo `hasRead`: o detalhe está a 1 toque em
// "O que mudou ›" e em "Detalhes ›" de cada caixa (guarda 8). Grava via `grantV04` (nunca insert); o
// servidor carimba a versão vigente.

import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ShieldCheck } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { createConsentService, REGULARIZATION_V04_COPY as COPY } from '@dosiq/core'
import { useConsentGate } from '@platform/consent/useConsentGate'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import ConsentBox, { type ConsentBoxVariant } from './ConsentBox'
import ConsentDetailsSheet from './ConsentDetailsSheet'

const consentService = createConsentService({ client: supabase as never })

interface ConsentRegularizationSheetProps {
  visible: boolean
  onConfirmed: () => void
  /** "Não concordo" — leva à retirada existente (Perfil › Privacidade e dados). */
  onDecline: () => void
}

export default function ConsentRegularizationSheet({ visible, onConfirmed, onDecline }: ConsentRegularizationSheetProps) {
  const { grantV04 } = useConsentGate()
  const [health, setHealth] = useState(false)
  const [transfer, setTransfer] = useState(false)
  const [healthError, setHealthError] = useState(false)
  const [changedOpen, setChangedOpen] = useState(false)
  const [details, setDetails] = useState<ConsentBoxVariant | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // B já vigente na v0.4 ⇒ a caixa B sai (pedir de novo, desmarcada, sugeria desligado — smoke B2 2.6).
  const [transferAlreadyOn, setTransferAlreadyOn] = useState(false)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    consentService
      .getStatus('international_transfer')
      .then((s) => { if (!cancelled) setTransferAlreadyOn(s.status === 'granted' && !s.stale) })
      .catch(() => { if (!cancelled) setTransferAlreadyOn(false) })
    return () => { cancelled = true }
  }, [visible])

  if (!visible) return null

  const handleHealthChange = (next: boolean) => {
    setHealth(next)
    if (next) setHealthError(false)
  }

  const handleConfirm = async () => {
    // CTA nunca fica cinza: sem A, o toque leva o foco à caixa com a mensagem (D-8).
    if (!health) {
      setHealthError(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await grantV04({ transfer: transfer && !transferAlreadyOn })
      if (!res.ok) {
        setError('Não foi possível registrar agora. Tente de novo.')
        return
      }
      onConfirmed()
    } catch {
      setError('Não foi possível registrar agora. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    // Bloqueante: `onRequestClose` sem efeito (voltar do Android não fecha sem decisão).
    <Modal visible transparent animationType="slide" onRequestClose={() => {}} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <View style={styles.backdrop} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <ShieldCheck size={22} color={colors.brand.primary} strokeWidth={2} />
          </View>
          <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
          <Text style={styles.description}>{COPY.body}</Text>

          <Pressable
            onPress={() => setChangedOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: changedOpen }}
            hitSlop={8}
          >
            <Text style={styles.link}>{COPY.changedLink}</Text>
          </Pressable>
          {changedOpen ? (
            <View style={styles.changed}>
              {COPY.changed.map((item) => (
                <Text key={item} style={styles.changedItem}>• {item}</Text>
              ))}
            </View>
          ) : null}

          <ConsentBox
            variant="health"
            checked={health}
            onChange={handleHealthChange}
            onDetails={() => setDetails('health')}
            disabled={saving}
            errorMessage={healthError ? COPY.errorNoHealth : null}
          />
          {transferAlreadyOn ? (
            <Text style={styles.transferOn}>{COPY.transferAlreadyOn}</Text>
          ) : (
            <ConsentBox
              variant="transfer"
              checked={transfer}
              onChange={setTransfer}
              onDetails={() => setDetails('transfer')}
              disabled={saving}
            />
          )}

          <Text style={styles.terms}>{COPY.termsFooter}</Text>

          {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}

          <Pressable
            onPress={handleConfirm}
            disabled={saving}
            style={({ pressed }) => [styles.primary, (pressed || saving) && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={COPY.confirm}
          >
            {saving ? <ActivityIndicator size="small" color={colors.text.inverse} /> : <Text style={styles.primaryLabel}>{COPY.confirm}</Text>}
          </Pressable>

          {/* Recusa visível, mesmo peso do secundário (guarda 5). */}
          <Pressable
            onPress={onDecline}
            disabled={saving}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={COPY.decline}
          >
            <Text style={styles.secondaryText}>{COPY.decline}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Overlay DENTRO deste Modal (Modal sobre Modal no iOS engole os gestos). */}
      <ConsentDetailsSheet variant={details} onClose={() => setDetails(null)} presentation="overlay" />
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  content: { gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[6] },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, fontFamily: typography.fontFamily.bold },
  description: { fontSize: 15, color: colors.text.secondary, lineHeight: 22 },
  link: { fontSize: 15, fontWeight: '600', color: colors.brand.primary },
  changed: { gap: spacing[1], padding: spacing[3], borderRadius: borderRadius.md, backgroundColor: colors.neutral[100] },
  changedItem: { fontSize: 14, lineHeight: 20, color: colors.text.primary },
  transferOn: { fontSize: 14, lineHeight: 20, color: colors.text.secondary },
  terms: { fontSize: 13, lineHeight: 19, color: colors.text.secondary },
  errorText: { fontSize: 13, fontWeight: '600', color: colors.status.error },
  primary: { minHeight: 52, borderRadius: borderRadius.lg, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 16, fontWeight: '700', color: colors.text.inverse },
  secondary: { minHeight: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  pressed: { opacity: 0.85 },
})
