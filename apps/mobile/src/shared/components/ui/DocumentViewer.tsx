// DocumentViewer.tsx — visualizador ÚNICO de documento dentro do app (spec 097 Slice B, B-1).
//
// Abre a política de privacidade (página web) e, no iOS, o PDF do relatório (arquivo do cache —
// o WKWebView renderiza PDF; o WebView do Android não, por isso o Android abre o PDF no app do
// sistema e nunca chega aqui com `kind: 'pdf'`).
//
// Guardas (vinculantes):
// - PDF: JavaScript desligado e navegação presa ao próprio arquivo.
// - Web: navegação presa a dosiq.app; qualquer outro endereço vai para o navegador do sistema.
//   JavaScript ligado porque o site é SPA. `incognito`: nada de cookie/armazenamento persistido.
// - `presentation="overlay"`: para hosts que JÁ são um Modal (Modal sobre Modal no iOS engole os
//   gestos — mesmo bug do picker do ExportSheet). O host renderiza este componente por último,
//   dentro do próprio Modal. Fora disso, `modal` (padrão).

import { useState } from 'react'
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, Linking, Platform, StatusBar } from 'react-native'
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics, type Metrics } from 'react-native-safe-area-context'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { colors, spacing, typography } from '@shared/styles/tokens'

export type DocumentSource = { kind: 'pdf'; uri: string } | { kind: 'web'; url: string }

interface DocumentViewerProps {
  /** null = fechado */
  source: DocumentSource | null
  title: string
  onClose: () => void
  presentation?: 'modal' | 'overlay'
}

// Métricas iniciais do provider próprio: as do aparelho; zero só onde não há janela nativa (jest).
const VIEWER_METRICS: Metrics = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
}

const ALLOWED_WEB_HOSTS = ['dosiq.app', 'www.dosiq.app']

function hostOf(url: string): string | null {
  const match = url.match(/^https:\/\/([^/?#:]+)/i)
  return match ? match[1].toLowerCase() : null
}

/** Decide se a navegação fica no viewer. Exportado para teste. */
export function shouldLoadInViewer(source: DocumentSource, url: string): boolean {
  if (source.kind === 'pdf') return url === source.uri
  if (url === 'about:blank') return true
  const host = hostOf(url)
  return host !== null && ALLOWED_WEB_HOSTS.includes(host)
}

function ViewerBody({ source, title, onClose }: { source: DocumentSource; title: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const handleShouldStart = (req: WebViewNavigation & { isTopFrame?: boolean }) => {
    // iOS consulta também os iframes da página; a trava vale para a navegação principal.
    if (source.kind === 'web' && req.isTopFrame === false) return true
    if (shouldLoadInViewer(source, req.url)) return true
    // Link externo da política (ex.: ANPD): sai para o navegador do sistema, nunca dentro do app.
    if (source.kind === 'web' && /^https?:\/\//i.test(req.url)) Linking.openURL(req.url).catch(() => {})
    return false
  }

  const isPdf = source.kind === 'pdf'
  const webSource = isPdf ? { uri: source.uri } : { uri: source.url }
  // iOS: o WKWebView só lê arquivo local dentro do diretório liberado — o do próprio PDF.
  const readAccess = isPdf ? source.uri.slice(0, source.uri.lastIndexOf('/') + 1) : undefined

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Text style={styles.closeText}>Fechar</Text>
        </Pressable>
      </View>

      {failed ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Não foi possível abrir o documento. Feche e tente de novo.</Text>
        </View>
      ) : (
        <View style={styles.webWrap}>
          <WebView
            testID="document-viewer-webview"
            source={webSource}
            javaScriptEnabled={!isPdf}
            originWhitelist={isPdf ? ['file://*'] : ['https://*']}
            allowingReadAccessToURL={readAccess}
            allowFileAccess={isPdf}
            incognito
            onShouldStartLoadWithRequest={handleShouldStart}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
          />
          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={colors.primary[600]} />
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  )
}

export default function DocumentViewer({ source, title, onClose, presentation = 'modal' }: DocumentViewerProps) {
  if (!source) return null

  if (presentation === 'overlay') {
    return (
      <View style={styles.overlay}>
        <SafeAreaProvider initialMetrics={VIEWER_METRICS}>
          <ViewerBody source={source} title={title} onClose={onClose} />
        </SafeAreaProvider>
      </View>
    )
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {Platform.OS === 'android' ? <View style={{ height: StatusBar.currentHeight ?? 0, backgroundColor: colors.bg.card }} /> : null}
      {/* Provider próprio: no iOS o Modal é outra janela e o provider da raiz devolve topo 0 —
          o cabeçalho ficava sob a Dynamic Island (smoke 097 B). */}
      <SafeAreaProvider initialMetrics={VIEWER_METRICS}>
        <ViewerBody source={source} title={title} onClose={onClose} />
      </SafeAreaProvider>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    backgroundColor: colors.bg.card,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: spacing[3],
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[700],
  },
  webWrap: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  errorText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
})
