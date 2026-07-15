// ConsentResolutionScreen.tsx — tela travada de resolução da revogação (spec 046, T010).
//
// É onde o app trava quando o estado do titular é `revoked`. Anti-deadlock (R2/F8): TRÊS saídas
// SEMPRE acessíveis — exportar, excluir, re-consentir — porque o guard usa ALLOWLIST (não
// denylist) e esta rota é uma das liberadas. Nenhuma delas pode desaparecer condicionalmente.

import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ShieldAlert, FileDown, Trash2, RotateCcw } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { HEALTH_CONSENT_COPY, createConsentService } from '@dosiq/core'
import { useConsentGate } from '@platform/consent/useConsentGate'
import ExportSheet from '@features/export/components/ExportSheet'
import ConsentPrompt from '@features/consent/components/ConsentPrompt'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

const consentService = createConsentService({ client: supabase as never })

export default function ConsentResolutionScreen() {
  const navigation = useNavigation()
  const gate = useConsentGate()
  const [showExport, setShowExport] = useState(false)
  const [reconsenting, setReconsenting] = useState(false)

  const goDelete = () => (navigation.navigate as any)(ROUTES.DELETE_ACCOUNT)

  // 🔴 "Voltar a consentir" NÃO concede num clique. Consentimento de dado sensível de saúde
  // (LGPD art. 11) tem que ser livre, INFORMADO e INEQUÍVOCO (art. 5º XII): o titular precisa VER a
  // copy do opt-in e MARCAR o checkbox de novo. Reativar com um toque seria consentimento presumido
  // — o mesmo vício que o gate combate no signup e no card. Por isso mostramos o ConsentPrompt.
  if (reconsenting) {
    return (
      <ConsentPrompt
        blocking={false}
        onGrant={() => consentService.grant('health_data', 'mobile')}
        onDismiss={() => setReconsenting(false)}
        onGranted={async () => {
          // DESTRAVA na hora: reavalia o gate compartilhado com o novo estado `granted`. Sem isto o
          // titular ficaria preso mesmo após reconsentir (o guard só reavaliava no próximo foreground).
          await gate.refresh()
        }}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerIcon}>
          <ShieldAlert size={26} color={colors.status.error} strokeWidth={2} />
        </View>
        <Text style={styles.title}>Consentimento retirado</Text>
        <Text style={styles.description}>{HEALTH_CONSENT_COPY.revokeWarning}</Text>

        <Pressable
          style={styles.optionCard}
          onPress={() => setShowExport(true)}
          accessibilityRole="button"
          accessibilityLabel="Exportar meus dados"
        >
          <FileDown size={20} color={colors.primary[600]} strokeWidth={2} />
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Exportar meus dados</Text>
            <Text style={styles.optionSubtitle}>Leve seus dados antes de decidir.</Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.optionCard}
          onPress={goDelete}
          accessibilityRole="button"
          accessibilityLabel="Excluir minha conta"
        >
          <Trash2 size={20} color={colors.status.error} strokeWidth={2} />
          <View style={styles.optionBody}>
            <Text style={[styles.optionTitle, styles.optionTitleDanger]}>Excluir minha conta</Text>
            <Text style={styles.optionSubtitle}>Apaga tudo agora, sem esperar os 90 dias.</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.optionCard, styles.optionCardPrimary]}
          onPress={() => setReconsenting(true)}
          accessibilityRole="button"
          accessibilityLabel="Voltar a consentir"
        >
          <RotateCcw size={20} color={colors.text.inverse} strokeWidth={2} />
          <View style={styles.optionBody}>
            <Text style={styles.optionTitleInverse}>Voltar a consentir</Text>
            <Text style={styles.optionSubtitleInverse}>Você revê a autorização e confirma.</Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Export inline: abre SOBRE a resolução. Fechar/cancelar volta pra cá — não para o hub
          (ponto do smoke: navegar pro PrivacyData parecia liberar o app). */}
      {showExport ? <ExportSheet visible onClose={() => setShowExport(false)} /> : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.error + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    marginBottom: spacing[6],
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
    marginBottom: spacing[3],
  },
  optionCardPrimary: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[600],
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  optionTitleDanger: {
    color: colors.status.error,
  },
  optionTitleInverse: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  optionSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  optionSubtitleInverse: {
    fontSize: 12,
    color: colors.text.inverse,
    opacity: 0.9,
    marginTop: 2,
  },
})
