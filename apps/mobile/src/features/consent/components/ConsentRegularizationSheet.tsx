// ConsentRegularizationSheet.tsx — nudge de política nova (spec 046, T011).
// Espelha TzIntentSheet (R-233: statusBarTranslucent + spacer Android).
//
// Alvo: titular que CONSENTIU numa versão ANTIGA da política (`stale`). NÃO trava o app — é um
// convite. "Agora não" dispensa sem escrever nada; aceitar chama consent_grant (nunca insert),
// que carimba a versão vigente no servidor.

import { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ShieldCheck, FileText } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { createConsentService } from '@dosiq/core'
import { EXTERNAL_URLS } from '../../../shared/constants'
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
  // Não se pode pedir novo aceite sem dar como ler a nova política. "Aceitar" fica travado até o
  // titular ABRIR e FECHAR a webview da política (openBrowserAsync resolve no fechamento) — assim
  // o aceite carimbado no consent_log corresponde a alguém que teve a política diante dos olhos.
  const [hasRead, setHasRead] = useState(false)

  if (!visible) return null

  const handleOpenPolicy = async () => {
    setError(null)
    try {
      await WebBrowser.openBrowserAsync(EXTERNAL_URLS.PRIVACY_POLICY)
      setHasRead(true)
    } catch {
      setError('Não foi possível abrir a política agora. Tente de novo.')
    }
  }

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
          Atualizamos a política de privacidade. Leia a nova versão e, se concordar, confirme seu
          consentimento de dados de saúde para continuar em dia.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleOpenPolicy}
          disabled={saving}
          style={({ pressed }) => [styles.btnRead, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Ler a nova política de privacidade"
        >
          <FileText size={16} color={colors.primary[600]} strokeWidth={2} />
          <Text style={styles.btnReadText}>
            {hasRead ? 'Política lida ✓' : 'Ler a nova política'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleAccept}
          disabled={saving || !hasRead}
          style={({ pressed }) => [
            styles.optionPrimary,
            (pressed || saving) && styles.pressed,
            !hasRead && styles.optionDisabled,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !hasRead }}
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
  btnRead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minHeight: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
    marginBottom: spacing[3],
  },
  btnReadText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[600],
  },
  optionPrimary: {
    minHeight: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  optionDisabled: {
    opacity: 0.45,
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
