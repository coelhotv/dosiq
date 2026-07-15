// PrivacyDataScreen.jsx — hub "Privacidade e dados" (spec 008, Adendo 2026-07-13, FR-007).
//
// Consolida num único lugar as funções LGPD hoje espalhadas: export de dados (novo),
// transparência (política — já existia como webview direta no Perfil) e exclusão de
// conta (saiu de Configurações, FR-008). Estrutura ENXUTA por decisão do PO (§UX): sem
// "Sessões ativas" e sem datas de versão de política — cortadas do mock fase-5 por
// densidade.

import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import * as WebBrowser from 'expo-web-browser'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, ChevronRight, ShieldCheck, FileDown, TriangleAlert } = LucideIcons as any
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { EXTERNAL_URLS } from '../../../shared/constants'
import ExportSheet from '@features/export/components/ExportSheet'
import PrivacyConsentSection from '@profile/components/PrivacyConsentSection'
import { createConsentService, parseISO } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

const consentService = createConsentService({ client: supabase as never })

/** dd/mm/aaaa a partir de um timestamp ISO — só formatação de exibição. */
function formatConsentDate(iso) {
  const d = parseISO(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function Header({ onGoBack }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onGoBack}
        style={styles.headerBtn}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <ChevronLeft size={24} color={colors.text.primary} />
      </Pressable>
      <Text style={styles.title}>Privacidade e dados</Text>
      <View style={styles.headerSpacer} />
    </View>
  )
}

function ExportSection({ onOpenSheet }) {
  return (
    <>
      <View style={[styles.sectionLabel, styles.sectionLabelMargin]}>
        <ShieldCheck size={12} color={colors.text.muted} />
        <Text style={styles.sectionLabelText}>SEUS DADOS</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardDescription}>
          Pacote completo dos seus dados em JSON ou CSV.
        </Text>
        <Pressable
          style={styles.exportButton}
          onPress={onOpenSheet}
          accessibilityRole="button"
          accessibilityLabel="Exportar dados"
        >
          <FileDown size={18} color={colors.text.inverse} strokeWidth={2} />
          <Text style={styles.exportButtonText}>Exportar dados</Text>
        </Pressable>
      </View>
    </>
  )
}

function TransparencySection({ onOpenPrivacyPolicy, consentMeta }) {
  return (
    <>
      <View style={[styles.sectionLabel, styles.sectionLabelMargin]}>
        <Text style={styles.sectionLabelText}>TRANSPARÊNCIA</Text>
      </View>
      <View style={styles.card}>
        <Pressable
          style={styles.linkRow}
          onPress={onOpenPrivacyPolicy}
          accessibilityRole="button"
          accessibilityLabel="Política de privacidade"
        >
          <View>
            <Text style={styles.linkRowTitle}>Política de privacidade</Text>
            {/* Datas cortadas do mock fase-5 do 008 (sem fonte na época) — voltam aqui com fonte
                real (consent_log, via consentService.getStatus). Sem evento, some sem quebrar. */}
            {consentMeta ? (
              <Text style={styles.linkRowSubtitle}>
                Aceito em {consentMeta.date}
                {consentMeta.version ? ` · v${consentMeta.version}` : ''}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={16} color={colors.primary[500]} />
        </Pressable>
      </View>
    </>
  )
}

function DangerZoneSection({ onDeleteAccount }) {
  return (
    <>
      <View style={[styles.sectionLabel, styles.sectionLabelMargin]}>
        <TriangleAlert size={12} color={colors.status.error} />
        <Text style={[styles.sectionLabelText, styles.sectionLabelDanger]}>ZONA DE RISCO</Text>
      </View>
      <View style={styles.card}>
        <Pressable
          style={styles.linkRow}
          onPress={onDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel="Excluir conta definitivamente"
        >
          <Text style={styles.dangerRowTitle}>Excluir conta definitivamente</Text>
          <ChevronRight size={16} color={colors.status.error} />
        </Pressable>
      </View>
    </>
  )
}

export default function PrivacyDataScreen() {
  const navigation = useNavigation()
  const route = useRoute()

  // `openExport` (vindo do banner da exclusão de conta): abre o sheet já na chegada, para o
  // usuário não ter que caçar o botão depois de pedir "exportar antes de apagar".
  const openExportParam = !!(route.params as { openExport?: boolean } | undefined)?.openExport
  const [exportSheetOpen, setExportSheetOpen] = useState(openExportParam)
  const [consentMeta, setConsentMeta] = useState(null)

  // O param é uma ORDEM, não estado da tela: consumir na chegada. Se ficar no state da
  // navegação, qualquer volta futura pra este hub (back, deep link) reabriria o sheet sozinho.
  useEffect(() => {
    if (openExportParam) (navigation as any).setParams({ openExport: undefined })
  }, [openExportParam, navigation])

  // Subtítulo "Aceito em dd/mm/aaaa · vX" na linha de Política — best-effort: falha de leitura
  // (getStatus lança) NÃO é tratada como "não informado", só deixa o subtítulo ausente.
  useEffect(() => {
    let active = true
    consentService
      .getStatus('health_data')
      .then((state) => {
        if (!active || state.status !== 'granted' || !state.updatedAt) return
        setConsentMeta({ date: formatConsentDate(state.updatedAt), version: state.policyVersion })
      })
      .catch(() => {
        if (active) setConsentMeta(null)
      })
    return () => {
      active = false
    }
  }, [])

  const goBack = () => (navigation as any).goBack()
  const openExportSheet = () => setExportSheetOpen(true)
  const closeExportSheet = () => setExportSheetOpen(false)
  const goToDeleteAccount = () => (navigation.navigate as any)(ROUTES.DELETE_ACCOUNT)
  const openPrivacyPolicy = () => WebBrowser.openBrowserAsync(EXTERNAL_URLS.PRIVACY_POLICY)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onGoBack={goBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerIcon}>
          <ShieldCheck size={22} color={colors.primary[600]} strokeWidth={2} />
        </View>
        <Text style={styles.subtitle}>Você decide quando exportar, compartilhar ou apagar.</Text>

        <PrivacyConsentSection />
        <ExportSection onOpenSheet={openExportSheet} />
        <TransparencySection onOpenPrivacyPolicy={openPrivacyPolicy} consentMeta={consentMeta} />
        <DangerZoneSection onDeleteAccount={goToDeleteAccount} />
      </ScrollView>

      {/* Montagem CONDICIONAL (não `visible` sobre um sheet sempre montado): o escopo e o
          período são escolha DAQUELA exportação, não preferência do usuário. Mantê-los vivos
          faria a próxima abertura vir com as marcações da anterior — e um checkbox desmarcado
          da vez passada silenciaria uma seção inteira do bundle sem o usuário pedir. Resetar
          por remontagem, nunca por effect (AP-285). */}
      {exportSheetOpen ? <ExportSheet visible onClose={closeExportSheet} /> : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[8],
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[5],
  },
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
  sectionLabelDanger: {
    color: colors.status.error,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  cardDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[3],
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[600],
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  linkRowSubtitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  dangerRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.status.error,
  },
})
