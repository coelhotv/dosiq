// OnboardingRefuseSheet.tsx — S2 `refuse` (spec 096 B3, T040c): o que acontece ao recusar o A.
//
// Três saídas, sem pressão: Voltar e autorizar (fecha) · Descartar e sair da conta (encerra a sessão —
// o rascunho do wizard vive só em memória e some junto; a fila do PostHog é descartada pelo resetUser
// do endSession) · Excluir a conta. Nada foi gravado até aqui (guarda 6).

import { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { ONBOARDING_REFUSE_COPY as COPY } from '../onboardingConsentCopy'

interface OnboardingRefuseSheetProps {
  onBack: () => void
  onDiscard: () => Promise<void>
  onDelete: () => void
}

export default function OnboardingRefuseSheet({ onBack, onDiscard, onDelete }: OnboardingRefuseSheetProps) {
  const [leaving, setLeaving] = useState(false)

  const handleDiscard = async () => {
    setLeaving(true)
    try {
      await onDiscard()
    } finally {
      setLeaving(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={leaving ? undefined : onBack} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={leaving ? undefined : onBack} accessibilityLabel={COPY.back} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
        <Text style={styles.body}>{COPY.body}</Text>

        <Pressable style={styles.primary} onPress={onBack} disabled={leaving} accessibilityRole="button" accessibilityLabel={COPY.back}>
          <Text style={styles.primaryText}>{COPY.back}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={handleDiscard} disabled={leaving} accessibilityRole="button" accessibilityLabel={COPY.discard}>
          {leaving ? <ActivityIndicator size="small" color={colors.text.primary} /> : <Text style={styles.secondaryText}>{COPY.discard}</Text>}
        </Pressable>
        <Pressable style={styles.danger} onPress={onDelete} disabled={leaving} accessibilityRole="button" accessibilityLabel={COPY.delete}>
          <Text style={styles.dangerText}>{COPY.delete}</Text>
        </Pressable>

        <Text style={styles.note}>{COPY.note}</Text>
      </SafeAreaView>
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
    gap: spacing[3],
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.neutral[300], alignSelf: 'center', marginBottom: spacing[2] },
  title: { fontSize: 18, fontWeight: '700', color: colors.text.primary, fontFamily: typography.fontFamily.bold },
  body: { fontSize: 15, lineHeight: 22, color: colors.text.secondary },
  primary: { minHeight: 52, borderRadius: borderRadius.lg, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.text.inverse },
  secondary: { minHeight: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  danger: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontSize: 15, fontWeight: '600', color: colors.status.error },
  note: { fontSize: 13, lineHeight: 19, color: colors.text.muted },
})
