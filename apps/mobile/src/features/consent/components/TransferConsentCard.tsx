// TransferConsentCard.tsx — cartão B em Privacidade e dados (spec 096 `priv-on/off/confirm`; espelho do
// TransferConsentCard web).
//
// Interruptor "Processamento fora do Brasil". Desligar = confirmação INLINE âmbar com os efeitos
// (Manter ligado · Desligar), sem trava — revogar B nunca bloqueia o app. Ligar = EnableTransferSheet
// (autorização completa, guarda 11). Depois de gravar, `gate.refresh()` reavalia o PostHog (CON-034).
// getStatus() LANÇA em falha de leitura — vira estado de erro, nunca "desligado".

import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, Switch, StyleSheet, ActivityIndicator } from 'react-native'
import { createConsentService, TRANSFER_TOGGLE_COPY as COPY } from '@dosiq/core'
import type { ConsentState } from '@dosiq/core'
import { useConsentGate } from '@platform/consent/useConsentGate'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import EnableTransferSheet from './EnableTransferSheet'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'

const consentService = createConsentService({ client: supabase as never })

export default function TransferConsentCard() {
  const gate = useConsentGate()
  const [state, setState] = useState<ConsentState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmOff, setConfirmOff] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [offError, setOffError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setState(await consentService.getStatus('international_transfer'))
    } catch {
      setState(null)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const isOn = state?.status === 'granted'

  const handleToggle = () => {
    if (isOn) setConfirmOff(true)
    else setEnabling(true)
  }

  const handleAuthorize = async () => {
    const res = await consentService.grant('international_transfer', 'mobile')
    if (!res.ok) return false
    setEnabling(false)
    await load()
    await gate.refresh()
    return true
  }

  const handleTurnOff = async () => {
    setSaving(true)
    setOffError(false)
    let ok = false
    try {
      ok = (await consentService.revoke('international_transfer', 'mobile')).ok
    } catch {
      ok = false
    }
    setSaving(false)
    if (!ok) {
      setOffError(true)
      return
    }
    setConfirmOff(false)
    await load()
    await gate.refresh()
  }

  return (
    <View style={styles.card}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{COPY.toggle}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.text.muted} />
        ) : (
          <Switch
            value={isOn}
            onValueChange={handleToggle}
            disabled={loadError || saving || confirmOff}
            trackColor={{ true: colors.brand.primary, false: colors.neutral[300] }}
            accessibilityLabel={COPY.toggle}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOn }}
          />
        )}
      </View>

      {loadError ? (
        <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Tentar de novo">
          <Text style={styles.retry}>Não foi possível carregar. Tentar de novo</Text>
        </Pressable>
      ) : !loading ? (
        <Text style={styles.meta}>{isOn ? COPY.on : COPY.off}</Text>
      ) : null}

      {confirmOff ? (
        <View style={styles.confirm} accessibilityLabel={COPY.offTitle}>
          <Text style={styles.confirmTitle}>{COPY.offTitle}</Text>
          {COPY.offEffects.map((e) => (
            <Text key={e} style={styles.confirmItem}>• {e}</Text>
          ))}
          {offError ? <Text style={styles.error} accessibilityRole="alert">{COPY.offError}</Text> : null}
          <View style={styles.confirmActions}>
            <Pressable
              style={styles.keep}
              onPress={() => { setConfirmOff(false); setOffError(false) }}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={COPY.offKeep}
            >
              <Text style={styles.keepText}>{COPY.offKeep}</Text>
            </Pressable>
            <Pressable style={styles.off} onPress={handleTurnOff} disabled={saving} accessibilityRole="button" accessibilityLabel={COPY.offConfirm}>
              {saving ? <ActivityIndicator size="small" color={colors.text.inverse} /> : <Text style={styles.offText}>{COPY.offConfirm}</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}

      {enabling ? <EnableTransferSheet onAuthorize={handleAuthorize} onCancel={() => setEnabling(false)} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[2],
    marginTop: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bg.card,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], minHeight: 48 },
  toggleLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text.primary },
  meta: { fontSize: 13, lineHeight: 19, color: colors.text.secondary },
  retry: { fontSize: 13, fontWeight: '600', color: colors.brand.primary },
  confirm: {
    gap: spacing[2],
    marginTop: spacing[2],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.warningLight,
  },
  confirmTitle: { fontSize: 14, fontWeight: '700', color: colors.status.warning },
  confirmItem: { fontSize: 13, lineHeight: 19, color: colors.text.primary },
  error: { fontSize: 13, fontWeight: '600', color: colors.status.error },
  confirmActions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  keep: { flex: 1, minHeight: 44, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center' },
  keepText: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  off: { flex: 1, minHeight: 44, borderRadius: borderRadius.md, backgroundColor: colors.status.warning, alignItems: 'center', justifyContent: 'center' },
  offText: { fontSize: 14, fontWeight: '700', color: colors.text.inverse },
})
