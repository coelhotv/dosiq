// ConsentRegularizationSheet.tsx — nudge de política nova (spec 046, T011).
// Espelha TzIntentSheet (R-233: statusBarTranslucent + spacer Android).
//
// Alvo: titular que CONSENTIU numa versão ANTIGA da política (`stale`). NÃO trava o app — é um
// convite. "Agora não" dispensa sem escrever nada; aceitar chama consent_grant (nunca insert),
// que carimba a versão vigente no servidor.

import { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ShieldCheck } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { createConsentService } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

const consentService = createConsentService({ client: supabase as never })

interface ConsentRegularizationSheetProps {
  visible: boolean
  onDismiss: () => void
  onConfirmed: () => void
}

export default function ConsentRegularizationSheet({
  visible,
  onDismiss,
  onConfirmed,
}: ConsentRegularizationSheetProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!visible) return null

  const handleAccept = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await consentService.grant('health_data', 'mobile')
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
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      {Platform.OS === 'android' ? (
        <View style={{ height: StatusBar.currentHeight ?? 0 }} />
      ) : null}
      <Pressable style={styles.backdrop} onPress={saving ? undefined : onDismiss} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.iconWrap}>
          <ShieldCheck size={22} color={colors.primary[600]} strokeWidth={2} />
        </View>
        <Text style={styles.title}>A política de privacidade mudou</Text>
        <Text style={styles.description}>
          Atualizamos a política de privacidade. Aceite a nova versão para continuar em dia com o
          seu consentimento de dados de saúde.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleAccept}
          disabled={saving}
          style={({ pressed }) => [styles.optionPrimary, (pressed || saving) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Aceitar a nova versão"
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.optionPrimaryLabel}>Aceitar a nova versão</Text>
          )}
        </Pressable>

        <Pressable
          onPress={onDismiss}
          disabled={saving}
          style={({ pressed }) => [styles.btnDismiss, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Agora não"
        >
          <Text style={styles.btnDismissText}>Agora não</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  errorText: {
    fontSize: 12,
    color: colors.status.error,
    marginBottom: spacing[3],
  },
  optionPrimary: {
    minHeight: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  optionPrimaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  btnDismiss: {
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pressed: {
    opacity: 0.85,
  },
})
