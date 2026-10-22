// EnableTransferSheet.tsx — ligar a caixa B (spec 096 `enableB`, guarda 11; espelho do
// EnableTransferModal web).
//
// Ligar B é SEMPRE a autorização completa: a frase verbatim da caixa B + "Detalhes ›", nunca um botão
// com nome de recurso. Aberta pela Privacidade e pelo chat ("Ver a autorização"). Autorizar só com a
// caixa marcada; sem ela, o mesmo padrão de erro da caixa A. Montagem condicional pelo host.

import { useState } from 'react'
import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ENABLE_TRANSFER_COPY as COPY } from '@dosiq/core'
import ConsentBox from './ConsentBox'
import ConsentDetailsSheet from './ConsentDetailsSheet'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

interface EnableTransferSheetProps {
  onAuthorize: () => Promise<boolean>
  onCancel: () => void
}

export default function EnableTransferSheet({ onAuthorize, onCancel }: EnableTransferSheetProps) {
  const [checked, setChecked] = useState(false)
  const [boxError, setBoxError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleChange = (next: boolean) => {
    setChecked(next)
    if (next) setBoxError(false)
  }

  const handleAuthorize = async () => {
    if (!checked) {
      setBoxError(true)
      return
    }
    setSaving(true)
    setError(null)
    let ok = false
    try {
      ok = await onAuthorize()
    } catch {
      ok = false
    } finally {
      setSaving(false)
    }
    if (!ok) setError('Não foi possível registrar agora. Tente de novo.')
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={saving ? undefined : onCancel} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={saving ? undefined : onCancel} accessibilityLabel={COPY.cancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
        <Text style={styles.body}>{COPY.body}</Text>

        <ConsentBox
          variant="transfer"
          checked={checked}
          onChange={handleChange}
          onDetails={() => setDetailsOpen(true)}
          disabled={saving}
          errorMessage={boxError ? COPY.errorNoBox : null}
        />

        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

        <Pressable
          onPress={handleAuthorize}
          disabled={saving}
          style={({ pressed }) => [styles.primary, (pressed || saving) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={COPY.authorize}
        >
          {saving ? <ActivityIndicator size="small" color={colors.text.inverse} /> : <Text style={styles.primaryText}>{COPY.authorize}</Text>}
        </Pressable>
        <Pressable
          onPress={onCancel}
          disabled={saving}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={COPY.cancel}
        >
          <Text style={styles.secondaryText}>{COPY.cancel}</Text>
        </Pressable>
      </SafeAreaView>
      <ConsentDetailsSheet variant={detailsOpen ? 'transfer' : null} onClose={() => setDetailsOpen(false)} presentation="overlay" />
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
  error: { fontSize: 13, fontWeight: '600', color: colors.status.error },
  primary: { minHeight: 52, borderRadius: borderRadius.lg, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.text.inverse },
  secondary: { minHeight: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  pressed: { opacity: 0.85 },
})
