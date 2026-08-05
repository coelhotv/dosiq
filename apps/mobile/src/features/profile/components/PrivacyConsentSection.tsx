// PrivacyConsentSection.tsx — card "Consentimento" no hub Privacidade e dados (spec 046, T012).
//
// Mostra o estado vigente (Ativo/Retirado/Não informado), a versão aceita + data (fonte:
// consentService.getStatus, que reflete o último evento em consent_log) e a ação de retirar,
// com confirmação de DUAS etapas mostrando HEALTH_CONSENT_COPY.revokeWarning.
//
// ⚠️ getStatus() LANÇA em falha de leitura (contrato do Slice A) — aqui isso vira estado de
// ERRO explícito, NUNCA "não informado". Confundir os dois ressuscitaria um revoked em silêncio
// se algum consumidor futuro decidisse agir sobre o texto exibido.

import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ShieldCheck, ShieldOff, ShieldQuestion } = LucideIcons as any
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { HEALTH_CONSENT_COPY, createConsentService, parseISO } from '@dosiq/core'
import type { ConsentState } from '@dosiq/core'
import { useConsentGate } from '@platform/consent/useConsentGate'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

const consentService = createConsentService({ client: supabase as never })

/** dd/mm/aaaa a partir de um timestamp ISO — só formatação de exibição, não derivação de dia. */
function formatConsentDate(iso: string): string {
  const d = parseISO(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function ConsentMissingState({ onGrant }: { onGrant: () => void }) {
  return (
    <>
      <Text style={styles.metaText}>
        Você ainda não autorizou o tratamento dos dados de saúde. Sem isso, o app não envia
        lembretes nem registra seu histórico.
      </Text>
      <Pressable
        style={styles.grantButton}
        onPress={onGrant}
        accessibilityRole="button"
        accessibilityLabel="Autorizar tratamento de dados de saúde"
      >
        <Text style={styles.grantButtonText}>Autorizar agora</Text>
      </Pressable>
    </>
  )
}

function ConsentRevokeFlow({
  confirmStep,
  revoking,
  onStart,
  onCancel,
  onStepTwo,
  onConfirm,
}: {
  confirmStep: 0 | 1 | 2
  revoking: boolean
  onStart: () => void
  onCancel: () => void
  onStepTwo: () => void
  onConfirm: () => void
}) {
  if (confirmStep === 0) {
    return (
      <Pressable
        style={styles.revokeButton}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Retirar consentimento"
      >
        <Text style={styles.revokeButtonText}>Retirar consentimento</Text>
      </Pressable>
    )
  }

  if (confirmStep === 1) {
    return (
      <View style={styles.confirmBox}>
        <Text style={styles.confirmWarning}>{HEALTH_CONSENT_COPY.revokeWarning}</Text>
        <View style={styles.confirmActions}>
          <Pressable
            style={styles.confirmCancel}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
          >
            <Text style={styles.confirmCancelText}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={styles.confirmProceed}
            onPress={onStepTwo}
            accessibilityRole="button"
            accessibilityLabel="Continuar retirada"
          >
            <Text style={styles.confirmProceedText}>Continuar</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.confirmBox}>
      <Text style={styles.confirmWarning}>
        Tem certeza? O app ficará bloqueado até você exportar, excluir a conta ou
        consentir novamente.
      </Text>
      <View style={styles.confirmActions}>
        <Pressable
          style={styles.confirmCancel}
          onPress={onCancel}
          disabled={revoking}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Text style={styles.confirmCancelText}>Cancelar</Text>
        </Pressable>
        <Pressable
          style={styles.confirmDanger}
          onPress={onConfirm}
          disabled={revoking}
          accessibilityRole="button"
          accessibilityLabel="Confirmar retirada de consentimento"
        >
          {revoking ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <Text style={styles.confirmDangerText}>Retirar consentimento</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const STATUS_META = {
  loading: { label: 'Carregando...', Icon: ShieldQuestion, color: colors.text.muted },
  error: { label: 'Não foi possível carregar', Icon: ShieldQuestion, color: colors.text.muted },
  missing: { label: 'Não informado', Icon: ShieldQuestion, color: colors.text.muted },
  granted: { label: 'Ativo', Icon: ShieldCheck, color: colors.status.success },
  revoked: { label: 'Retirado', Icon: ShieldOff, color: colors.status.error },
} as const

function _getConsentResolved(loading: boolean, loadError: boolean, stateStatus?: string): 'loading' | 'error' | 'missing' | 'granted' | 'revoked' {
  if (loading) return 'loading'
  if (loadError) return 'error'
  if (stateStatus && Object.hasOwn(STATUS_META, stateStatus)) {
    return stateStatus as keyof typeof STATUS_META
  }
  return 'missing'
}

export default function PrivacyConsentSection() {
  const navigation = useNavigation()
  const gate = useConsentGate()
  const [state, setState] = useState<ConsentState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0)
  const [revoking, setRevoking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const current = await consentService.getStatus('health_data')
      setState(current)
    } catch {
      setState(null)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  const handleRevoke = async () => {
    setRevoking(true)
    try {
      const res = await consentService.revoke('health_data', 'mobile')
      if (res.ok) {
        await load()
        await gate.refresh()
      }
    } catch {
      // revoke rejeitou — sem isto o botão ficaria travado em loading.
    } finally {
      setRevoking(false)
      setConfirmStep(0)
    }
  }

  const resolved = _getConsentResolved(loading, loadError, state?.status)
  const { label: statusLabel, Icon: StatusIcon, color: statusColor } = STATUS_META[resolved]

  return (
    <>
      <View style={[styles.sectionLabel, styles.sectionLabelMargin]}>
        <ShieldCheck size={12} color={colors.text.muted} />
        <Text style={styles.sectionLabelText}>CONSENTIMENTO</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <StatusIcon size={18} color={statusColor} />
          <Text style={styles.statusLabel}>{statusLabel}</Text>
          {loading ? <ActivityIndicator size="small" color={colors.text.muted} /> : null}
        </View>

        {!loading && !loadError && state && state.status === 'granted' && state.updatedAt ? (
          <Text style={styles.metaText}>
            Aceito em {formatConsentDate(state.updatedAt)}
            {state.policyVersion ? ` · v${state.policyVersion}` : ''}
          </Text>
        ) : null}

        {loadError ? (
          <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Tentar de novo">
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        ) : null}

        {!loading && !loadError && state?.status === 'missing' ? (
          <ConsentMissingState onGrant={() => navigation.navigate(ROUTES.CONSENT_PROMPT as never)} />
        ) : null}

        {!loading && !loadError && state?.status === 'granted' ? (
          <ConsentRevokeFlow
            confirmStep={confirmStep}
            revoking={revoking}
            onStart={() => setConfirmStep(1)}
            onCancel={() => setConfirmStep(0)}
            onStepTwo={() => setConfirmStep(2)}
            onConfirm={handleRevoke}
          />
        ) : null}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginBottom: spacing[2],
  },
  sectionLabelMargin: {
    marginTop: spacing[5],
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.text.muted,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing[1],
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[600],
    marginTop: spacing[2],
  },
  grantButton: {
    marginTop: spacing[3],
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  revokeButton: {
    marginTop: spacing[3],
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revokeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.status.error,
  },
  confirmBox: {
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.errorLight,
  },
  confirmWarning: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
    marginBottom: spacing[3],
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  confirmCancel: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  confirmProceed: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmProceedText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  confirmDanger: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.inverse,
  },
})
