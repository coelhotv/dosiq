// ConsentDetailsSheet.tsx — folha "Detalhes ›" das caixas A e B (spec 096: S6-A e `sheetB`; espelho do
// ConsentDetailsSheet web). Copy VERBATIM do core — a mesma fonte da web e da política.
// Folha B, ordem do PO (20/10): "Sem a autorização" → contraste do lembrete → tabela → como mudar.
//
// `presentation`: 'modal' (tela comum) ou 'overlay' (dentro de outro Modal — Modal sobre Modal no iOS
// engole os gestos; mesmo padrão do DocumentViewer). Montada pelo host só quando `variant` ≠ null.

import { useState } from 'react'
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, Platform, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { HEALTH_CONSENT_COPY, TRANSFER_CONSENT_COPY } from '@dosiq/core'
import DocumentViewer from '@shared/components/ui/DocumentViewer'
import { EXTERNAL_URLS } from '../../../shared/constants'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import type { ConsentBoxVariant } from './ConsentBox'

interface ConsentDetailsSheetProps {
  variant: ConsentBoxVariant | null
  onClose: () => void
  presentation?: 'modal' | 'overlay'
}

function TransferDetails() {
  return (
    <>
      <Text style={styles.subtitle}>{TRANSFER_CONSENT_COPY.withoutTitle}</Text>
      <Text style={styles.text}>{TRANSFER_CONSENT_COPY.without}</Text>

      <View style={styles.contrast}>
        <Text style={styles.contrastLabel}>Com autorização</Text>
        <Text style={styles.push}>{TRANSFER_CONSENT_COPY.contrastWith}</Text>
        <Text style={[styles.contrastLabel, styles.contrastGap]}>Sem autorização</Text>
        <Text style={styles.push}>{TRANSFER_CONSENT_COPY.contrastWithout}</Text>
      </View>

      {TRANSFER_CONSENT_COPY.table.map((row) => (
        <Text key={row.use} style={styles.text}>
          <Text style={styles.strong}>{row.use}</Text>: {row.data} → {row.to}
        </Text>
      ))}

      <Text style={styles.text}>{TRANSFER_CONSENT_COPY.howToChange}</Text>
    </>
  )
}

export default function ConsentDetailsSheet({ variant, onClose, presentation = 'modal' }: ConsentDetailsSheetProps) {
  const [policyOpen, setPolicyOpen] = useState(false)
  if (!variant) return null

  const title = variant === 'health' ? HEALTH_CONSENT_COPY.detailsTitle : TRANSFER_CONSENT_COPY.sheetTitle

  const content = (
    <View style={StyleSheet.absoluteFill}>
      {Platform.OS === 'android' && presentation === 'modal' ? <View style={{ height: StatusBar.currentHeight ?? 0 }} /> : null}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar">
            <Text style={styles.close}>Fechar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {variant === 'health' ? <Text style={styles.text}>{HEALTH_CONSENT_COPY.details}</Text> : <TransferDetails />}
          <Pressable onPress={() => setPolicyOpen(true)} accessibilityRole="link">
            <Text style={styles.link}>Ler a política completa</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      <DocumentViewer
        source={policyOpen ? { kind: 'web', url: EXTERNAL_URLS.PRIVACY_POLICY } : null}
        title="Política de privacidade"
        onClose={() => setPolicyOpen(false)}
        presentation="overlay"
      />
    </View>
  )

  if (presentation === 'overlay') return content
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {content}
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
    maxHeight: '85%',
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginBottom: spacing[3],
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  title: { fontSize: 18, fontWeight: '700', color: colors.text.primary, fontFamily: typography.fontFamily.bold, flex: 1 },
  close: { fontSize: 15, fontWeight: '600', color: colors.brand.primary },
  body: { gap: spacing[3], paddingBottom: spacing[4] },
  subtitle: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  text: { fontSize: 15, lineHeight: 22, color: colors.text.secondary },
  strong: { fontWeight: '700', color: colors.text.primary },
  contrast: { padding: spacing[3], borderRadius: borderRadius.md, backgroundColor: colors.neutral[100] },
  contrastLabel: { fontSize: 12, fontWeight: '700', color: colors.neutral[600] },
  contrastGap: { marginTop: spacing[2] },
  push: { fontSize: 15, color: colors.text.primary, marginTop: 2 },
  link: { fontSize: 15, fontWeight: '600', color: colors.brand.primary, textDecorationLine: 'underline' },
})
