// OnboardingConsentStep — S1 do fim do onboarding (spec 096 B3, T040b; artboards `dq2a`/`save`/
// `save-err`/`empty`).
//
// Único ponto que GRAVA o setup, e só depois do consentimento A (guarda 6, PO-UX-2). Ordem:
//   grant A (+ Termos/Política do rodapé do cadastro) ⇒ grant B se marcada (falha não bloqueia: aviso)
//   ⇒ escritas do setup ⇒ permissão de push (intenção do passo de tratamento) ⇒ saldo (opção 2) ou app.
// Variante `empty` ("Pular" em S2–S4): mesmas caixas, sem resumo; conclui sem escrever remédio.
// CTA nunca cinza (D-8): sem A, foco na caixa + `alert`. B nunca é condição (guarda 4).
// "Agora não" ⇒ S2 (OnboardingRefuseSheet).

import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { useConsentGate } from '@platform/consent/useConsentGate'
import { enablePushAtIntent } from '@platform/notifications/pushPermission'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { endSession } from '@platform/session/endSession'
import { ROUTES } from '@navigation/routes'
import ConsentBox, { type ConsentBoxVariant } from '@features/consent/components/ConsentBox'
import ConsentDetailsSheet from '@features/consent/components/ConsentDetailsSheet'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import OnboardingRefuseSheet from '@features/onboarding/components/OnboardingRefuseSheet'
import { useOnboarding } from '../OnboardingContext'
import { timed } from '@features/onboarding/hooks/useOnboardingSetupWrites'
import { ONBOARDING_CONSENT_COPY as COPY } from '../onboardingConsentCopy'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

function summaryLines(medicine, treatment): { name: string; detail: string | null } | null {
  if (!medicine?.name) return null
  const strength = medicine.dosage_per_pill ? ` ${medicine.dosage_per_pill} ${medicine.dosage_unit ?? ''}`.trimEnd() : ''
  const times = Array.isArray(treatment?.time_schedule) ? treatment.time_schedule.join(', ') : ''
  const dose = treatment?.dosage_per_intake ? `${treatment.dosage_per_intake} por dose` : ''
  const detail = [dose, times].filter(Boolean).join(' · ')
  return { name: `${medicine.name}${strength}`, detail: detail || null }
}

export default function OnboardingConsentStep() {
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const { medicine, medicineSource, treatment, stockTracking, writeSetup, finish, markCompleted } = useOnboarding()
  const gate = useConsentGate()
  const { refresh: refreshStockTracking } = useStockTracking()
  const { show } = useToast()

  const [health, setHealth] = useState(false)
  const [transfer, setTransfer] = useState(false)
  const [healthError, setHealthError] = useState(false)
  const [details, setDetails] = useState<ConsentBoxVariant | null>(null)
  const [refuseOpen, setRefuseOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const empty = route.params?.variant === 'empty' || !medicine || !treatment
  const summary = useMemo(() => (empty ? null : summaryLines(medicine, treatment)), [empty, medicine, treatment])
  const headerProps = useMemo(() => ({ step: 4, totalSteps: 4, onBack: () => navigation.goBack() }), [navigation])

  const handleHealthChange = useCallback((next: boolean) => {
    setHealth(next)
    if (next) setHealthError(false)
  }, [])

  const handleSave = useCallback(async () => {
    if (!health) {
      setHealthError(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await timed(gate.grantV04({ transfer }))
      if (!res.ok) {
        setError(COPY.grantError)
        setSaving(false)
        return
      }
      if (transfer && !res.transferOk) show(COPY.transferNotSaved, { variant: 'info', duration: 6000 })

      if (empty) {
        await timed(finish())
        return
      }

      const { remind } = await writeSetup({ medicine, medicineSource, treatment, stockTracking })
      // O provider lê a preferência UMA vez (no login) — sem este refresh, o app abre com o valor
      // lido ANTES desta escolha (aba Estoque para quem escolheu dose-only).
      await timed(refreshStockTracking())

      // Ponto de intenção: só pede permissão de push se a pessoa LIGOU o lembrete no passo de tratamento.
      if (remind) {
        const { granted } = await enablePushAtIntent({ supabase }).catch(() => ({ granted: false }))
        if (!granted) show('Tudo bem! Você pode ligar os lembretes depois em Configurações.', { variant: 'info', duration: 6000 })
      }

      // Opção 2 leva ao saldo inicial. Marca a conclusão ANTES de navegar: o setup já está gravado e o
      // saldo é opcional — matar o app ali reabriria o wizard (classe do AP-283, spec 044 F4b).
      if (stockTracking) {
        await timed(markCompleted())
        setSaving(false)
        navigation.navigate(ROUTES.ONBOARDING_STOCK_INITIAL_BALANCE)
        return
      }
      await timed(finish())
    } catch (err) {
      setSaving(false)
      setError(err?.message ?? 'Não foi possível concluir. Tente de novo.')
    }
  }, [health, transfer, gate, show, empty, finish, writeSetup, medicine, medicineSource, treatment, stockTracking, refreshStockTracking, markCompleted, navigation])

  const handleDiscard = useCallback(async () => {
    await endSession('logout')
  }, [])

  const handleDelete = useCallback(() => {
    setRefuseOpen(false)
    navigation.navigate(ROUTES.DELETE_ACCOUNT)
  }, [navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader {...(headerProps as any)} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">{empty ? COPY.emptyTitle : COPY.title}</Text>
        <Text style={styles.subtitle}>{empty ? COPY.emptyBody : COPY.body}</Text>

        {summary ? (
          <View style={styles.summary}>
            <Text style={styles.summaryName}>{summary.name}</Text>
            {summary.detail ? <Text style={styles.summaryDetail}>{summary.detail}</Text> : null}
          </View>
        ) : null}

        <View style={styles.boxes}>
          <ConsentBox
            variant="health"
            checked={health}
            onChange={handleHealthChange}
            onDetails={() => setDetails('health')}
            disabled={saving}
            errorMessage={healthError ? COPY.errorNoHealth : null}
          />
          <ConsentBox
            variant="transfer"
            checked={transfer}
            onChange={setTransfer}
            onDetails={() => setDetails('transfer')}
            disabled={saving}
          />
        </View>

        {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}
      </ScrollView>

      <FormActions
        primaryLabel={empty ? COPY.emptyCta : COPY.cta}
        onPrimary={handleSave}
        primaryLoading={saving}
      />
      <Pressable
        style={styles.later}
        onPress={() => setRefuseOpen(true)}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={COPY.later}
      >
        <Text style={styles.laterText}>{COPY.later}</Text>
      </Pressable>

      <ConsentDetailsSheet variant={details} onClose={() => setDetails(null)} />
      {refuseOpen ? (
        <OnboardingRefuseSheet onBack={() => setRefuseOpen(false)} onDiscard={handleDiscard} onDelete={handleDelete} />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.screen },
  scroll: { flexGrow: 1, paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[6] },
  title: {
    fontSize: 24,
    fontFamily: typography.fontFamily.bold || 'System',
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 15,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing[4],
  },
  summary: {
    padding: spacing[4],
    marginBottom: spacing[4],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryName: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  summaryDetail: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  boxes: { gap: spacing[3] },
  error: { marginTop: spacing[3], fontSize: 14, fontWeight: '600', color: colors.status.error },
  later: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  laterText: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
})
