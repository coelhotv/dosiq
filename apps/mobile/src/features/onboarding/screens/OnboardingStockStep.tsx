// OnboardingStockStep — passo 4/4 do wizard: escolha do modo de uso (spec 044, FR-001 / PO-2).
//
// ÚLTIMO passo (conta → medicamento → tratamento → estoque): medicamento e tratamento são um
// setup natural sobre o mesmo modelo mental; estoque é a pergunta seguinte, não uma interrupção
// no meio (decisão do PO, 11/07/2026 — reverte o design-brief).
//
// Sem terceiro estado: a opção 1 (dose-only) vem PRÉ-MARCADA e "Continuar" está SEMPRE ativo —
// nunca existe "sem seleção". Copy §9 do SPEC_044_DOSE-ONLY_DECISOES (copiada, não reescrita).

import { useState, useCallback, useMemo } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { CalendarClock, Box, Info } = LucideIcons as any
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { setStockTracking } from '@profile/services/profileService'
import { protocolService } from '@treatments/services/protocolService'
import { medicineService } from '@medications/services/medicineService'
import { enablePushAtIntent } from '@platform/notifications/pushPermission'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { useOnboarding } from '../OnboardingContext'
import OnboardingHeader from '@features/onboarding/components/OnboardingHeader'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const OPTIONS = [
  {
    id: 'doses',
    tracking: false,
    Icon: CalendarClock,
    title: 'Só lembrar e registrar minhas doses',
    subtitle: 'Lembretes na hora certa e um toque para marcar como tomada.',
  },
  {
    id: 'stock',
    tracking: true,
    Icon: Box,
    title: 'Também avisar quando o remédio estiver acabando',
    subtitle: 'Além dos lembretes, o Dosiq acompanha seu estoque e avisa antes de faltar.',
  },
]

export default function OnboardingStockStep() {
  const navigation = useNavigation()
  const { medicine, treatment, finish } = useOnboarding()
  const { show } = useToast()

  // Opção 1 pré-marcada: o modo dose-only é o default do onboarding (a preferência no banco
  // nasce `true` por FR-009 — quem escolhe aqui é quem está criando a conta agora).
  const [selected, setSelected] = useState('doses')
  const [submitting, setSubmitting] = useState(false)

  const headerProps = useMemo(
    () => ({ step: 3, totalSteps: 4, onBack: () => navigation.goBack(), onSkip: finish }),
    [navigation, finish],
  )

  // Este é o passo que GRAVA o onboarding inteiro: medicamento, tratamento, permissão de push
  // e a preferência de estoque. Os passos anteriores só acumulam no contexto — é o que torna o
  // botão "voltar" seguro (voltar e continuar de novo não duplica nada no banco).
  const handleContinue = useCallback(async () => {
    const option = OPTIONS.find((o) => o.id === selected)
    setSubmitting(true)
    try {
      if (!medicine || !treatment) {
        throw new Error('Dados do onboarding não encontrados. Volte e revise os passos.')
      }

      const createdMedicine = await medicineService.create(medicine)

      const { _remind, ...protocolData } = treatment
      await protocolService.create({
        ...protocolData,
        medicine_id: createdMedicine.id,
      })

      await setStockTracking(option.tracking)

      // Ponto de intenção: só pede permissão de push se o usuário LIGOU o lembrete no passo 3.
      // Concedeu → registra token já (lembretes funcionam de cara). Negou no SO → segue o
      // fluxo; a dona Maria reativa depois em Configurações (sem nag aqui).
      if (_remind) {
        const { granted } = await enablePushAtIntent({ supabase }).catch(() => ({ granted: false }))
        if (!granted) {
          show('Tudo bem! Você pode ligar os lembretes depois em Configurações.', { variant: 'info', duration: 6000 })
        }
      }

      // Opção 2 (opt-in) leva ao saldo inicial (Artefato F) — entregue na F4b da spec 044.
      // Até lá, ativar aqui já entrega o comportamento atual do app (estoque ligado).
      await finish()
    } catch (err) {
      // Não avança em silêncio: deixa o usuário tentar de novo em vez de cair num app que não
      // é o que ele escolheu — ou pior, sem o tratamento que ele acabou de configurar.
      setSubmitting(false)
      show(err?.message ?? 'Não foi possível concluir. Tente de novo.', { variant: 'error' })
    }
  }, [selected, medicine, treatment, finish, show])

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OnboardingHeader {...(headerProps as any)} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Como o Dosiq pode te ajudar?</Text>
        <Text style={styles.subtitle}>Escolha o que faz mais sentido pra você agora.</Text>

        <View style={styles.options} accessibilityRole="radiogroup">
          {OPTIONS.map((option) => {
            const isSelected = option.id === selected
            const { Icon } = option
            return (
              <Pressable
                key={option.id}
                style={[styles.option, isSelected ? styles.optionSelected : null]}
                onPress={() => setSelected(option.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${option.title}. ${option.subtitle}`}
              >
                <View style={[styles.optionIcon, isSelected ? styles.optionIconSelected : null]}>
                  <Icon size={22} color={colors.brand.primary} strokeWidth={1.75} />
                </View>

                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>

                {/* Radio à direita (mock onboarding-s3-dose-mode): decorativo — o estado de
                    seleção é anunciado pelo accessibilityState do card inteiro. */}
                <View style={[styles.radio, isSelected ? styles.radioSelected : null]}>
                  {isSelected ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.tip}>
          <Info size={18} color={colors.text.secondary} strokeWidth={2} />
          <Text style={styles.tipText}>Dá para mudar isso quando quiser, em Configurações.</Text>
        </View>
      </ScrollView>

      <FormActions
        primaryLabel="Continuar"
        onPrimary={handleContinue}
        primaryLoading={submitting}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
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
    marginBottom: spacing[6],
  },
  options: {
    gap: spacing[3],
  },
  option: {
    // Alvo de toque generoso (≥76px): o card inteiro é o alvo, não só o radio.
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg || 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  optionSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.light || colors.bg.card,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md || 12,
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: {
    backgroundColor: colors.bg.card,
    borderColor: colors.brand.primary,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.brand.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand.primary,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.medium || 'System',
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 20,
  },
  tip: {
    marginTop: spacing[4],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg || 16,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular || 'System',
    color: colors.text.secondary,
    lineHeight: 20,
  },
})
