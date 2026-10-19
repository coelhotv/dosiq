// BarcodeScannerScreen — lê o EAN-13 da caixa e devolve o RASCUNHO a quem abriu (spec 066 D1/D2).
//
// D2: também abre pelo registro de compra (`returnTo: PURCHASE_FORM`); o rascunho volta com o EAN lido
// (`scanEan`), que o cadastro ignora e a compra grava.
//
// RC3 (abordagem A, PO 2026-10-16): esta tela não grava nada e não tem confirmação própria. Ela
// resolve o código enquanto o índice está em memória e volta ao `MedicineFormScreen` com o rascunho
// pronto (E-2: nunca um `rowIdx`); o form é a confirmação e só o Salvar dele grava (INV-1).
// A câmera só existe com a tela em foco e o app ativo (E-3) e só a 1ª leitura conta (E-4).
// A imagem nunca sai do aparelho: não há foto nem gravação, só o callback de código (FR-025).

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native'
import { CameraView, useCameraPermissions } from 'expo-camera'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 (ver TreatmentsScreen.tsx)
import * as LucideIcons from 'lucide-react-native'
import { CmedPresentationStep } from '@medications/components/CmedPresentationStep'
import { useCmedIndex } from '@shared/hooks/useCmedIndex'
import { ROUTES } from '@navigation/routes'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { colors, spacing } from '@shared/styles/tokens'
import { selectionTap } from '@shared/utils/haptics'
import { STORE_FALLBACK_URLS } from '@platform/versionGate/storeUrls'
import { clearScanResume, markScanResume } from './scanResume'
import { manualLabel } from './scanCopy'
import { useCameraAssist } from './useCameraAssist'
import { FullStateScreen, ManualLink, VisorSheet, type FullScreenState } from './ScanStatePanel'
import {
  ILLEGIBLE_TIMEOUT_MS,
  INITIAL_SCAN_LOCAL,
  draftFromPick,
  effectivePermission,
  permissionOutcome,
  resolveScannedEan,
  scanLocalReducer,
  scanScreenState,
  type PermissionOutcome,
  type ScanPermission,
  type ScanScreen,
} from './scanFlow'

const { X, Sun, ZoomIn } = LucideIcons as any

const FULL_SCREENS = new Set<ScanScreen>(['pre_permission', 'denied', 'blocked', 'offline', 'version'])

// Resultado já reportado ao analytics para esta tela (um evento por estado de falha).
const REPORTED_RESULTS: Partial<Record<ScanScreen, string>> = {
  offline: 'offline',
  index_failed: 'index_failed',
  version: 'version',
  illegible: 'illegible',
}

function toPermission(raw: { granted: boolean; canAskAgain: boolean; status: string } | null): ScanPermission | null {
  if (!raw) return null
  const status = raw.status === 'granted' || raw.status === 'denied' ? raw.status : 'undetermined'
  return { granted: raw.granted, canAskAgain: raw.canAskAgain, status }
}

// Visor da câmera (artboard `f1-scan`). Sem `cameraOn` (fora de foco, app em background) o CameraView
// nem monta (E-3). `preparing`: o índice ainda carrega — faixa dentro do quadro, "só na 1ª vez".
// `sheet`: estados que cobrem o visor (ilegível, não encontrado, falha do índice).
// C-15: tocar no visor pede novo foco; "Aproximar" liga o zoom (câmera que não foca de perto).
function ScannerVisor({ cameraOn, preparing, torch, onTorch, onBarcode, onClose, onManual, sheet, purchase }) {
  const assist = useCameraAssist(cameraOn && !sheet)
  const hint = assist.tip
    ? 'Não está lendo? Afaste um pouco a caixa e toque em Aproximar.'
    : 'Aponte para o código de barras: as listras com números.'
  return (
    <View style={styles.visor}>
      {cameraOn ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          zoom={assist.zoom}
          autofocus={assist.focusMode}
          barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
          onBarcodeScanned={onBarcode}
        />
      ) : null}
      {cameraOn ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={assist.refocus} accessibilityRole="button" accessibilityLabel="Focar de novo" />
      ) : null}
      <View style={styles.visorTop}>
        <Pressable onPress={onClose} style={styles.roundButton} accessibilityRole="button" accessibilityLabel="Fechar">
          <X size={22} color={colors.text.inverse} />
        </Pressable>
        {cameraOn ? (
          <View style={styles.visorActions}>
            <Pressable
              onPress={assist.toggleZoom}
              style={[styles.roundButton, styles.torchButton, assist.zoomed && styles.torchOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: assist.zoomed }}
              accessibilityLabel="Aproximar"
            >
              <ZoomIn size={20} color={colors.text.inverse} />
              <Text style={styles.torchText}>Aproximar</Text>
            </Pressable>
            <Pressable
              onPress={onTorch}
              style={[styles.roundButton, styles.torchButton, torch && styles.torchOn]}
              accessibilityRole="switch"
              accessibilityState={{ checked: torch }}
              accessibilityLabel="Lanterna"
            >
              <Sun size={20} color={colors.text.inverse} />
              <Text style={styles.torchText}>Lanterna</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={[styles.frame, assist.focusing && styles.frameFocusing]} pointerEvents="none">
        {preparing ? (
          <View style={styles.prepBox} accessibilityRole="progressbar" accessibilityLabel="Preparando a leitura">
            <View style={styles.prepTrack}>
              <View style={styles.prepFill} />
            </View>
            <Text style={styles.prepText}>Só na 1ª vez · menos de 1 MB</Text>
          </View>
        ) : null}
      </View>
      {sheet ? null : (
        <Text style={styles.hintText} accessibilityRole="text">
          {preparing ? 'Preparando a leitura (só na 1ª vez). Pode ir digitando.' : hint}
        </Text>
      )}
      {sheet ?? (
        <View style={styles.visorBottom}>
          <ManualLink onPress={onManual} dark label={manualLabel(purchase)} />
        </View>
      )}
    </View>
  )
}

// PO-8: tempo de carga do índice no campo (mesmo evento do sheet de busca).
function logIndexLoaded(info) {
  logEvent(EVENTS.MEDICINE_INDEX_LOADED, {
    surface: SURFACES.MOBILE,
    source: info.source,
    duration_ms: info.durationMs,
    status: info.status,
    row_count: info.rowCount,
  })
}

// Passo 2 restrito às linhas do EAN (FR-026): escolher a concentração antes de preencher.
function ChoosingStep({ local, onPick, onSkip, onBack }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {local.phase === 'choosing' ? (
        <View style={styles.choosing}>
          <CmedPresentationStep title={local.title} options={local.options} onPick={onPick} onSkip={onSkip} onBack={onBack} />
        </View>
      ) : null}
    </SafeAreaView>
  )
}

// Para onde a leitura volta (D2): o cadastro (default, D1) ou o registro de compra (`returnTo`).
// ✕ só fecha. A saída "manual" volta ao cadastro já rolado até "Identificação" (smoke C-D1-3); na
// compra é só voltar, com o form como a pessoa deixou; na aba Estoque (FR-030) abre o seletor do FAB. O rascunho volta com o EAN lido (`scanEan`),
// guardado em ref porque o passo 2 (escolha da concentração) devolve o mesmo código.
function useScanReturn(navigation, route) {
  const entryPoint = route.params?.entryPoint ?? 'medicine_form'
  const returnTo = route.params?.returnTo ?? ROUTES.MEDICINE_CREATE
  const fromMedicineForm = returnTo === ROUTES.MEDICINE_CREATE
  // Texto de compra ("Preencher digitando") só nos destinos de compra, por nome: outra origem (ex.:
  // onboarding, Slice E) não herda o texto por "não ser o cadastro".
  const purchase = returnTo === ROUTES.PURCHASE_FORM || returnTo === ROUTES.STOCK_MAIN
  const scannedEanRef = useRef<string | null>(null)
  const close = useCallback(() => navigation.goBack(), [navigation])
  const goManual = useCallback(
    () =>
      // Na compra o form ignora `manualEntry` (volta como estava); na aba Estoque ele abre o seletor do FAB.
      navigation.popTo(returnTo, { manualEntry: Date.now() }, { merge: true }),
    [navigation, returnTo],
  )
  // Volta ao form que abriu o scanner, com o rascunho; ele é a confirmação (RC3 A).
  const returnDraft = useCallback(
    (draft) => navigation.popTo(returnTo, { scanDraft: draft, scanEan: scannedEanRef.current }, { merge: true }),
    [navigation, returnTo],
  )
  return { entryPoint, fromMedicineForm, purchase, scannedEanRef, close, goManual, returnDraft }
}

export default function BarcodeScannerScreen() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const isFocused = useIsFocused()
  // Só background/inactive desligam; estado ainda desconhecido (null/unknown) conta como ativo.
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive')
  const [torch, setTorch] = useState(false)
  const [local, dispatch] = useReducer(scanLocalReducer, INITIAL_SCAN_LOCAL)
  const [rawPermission, requestPermission, getPermission] = useCameraPermissions()
  // C-D1-5: resposta do pedido real no Android ("Perguntar sempre" parece bloqueada sem estar).
  const [probe, setProbe] = useState<PermissionOutcome | null>(null)
  const isAndroid = Platform.OS === 'android'
  const probingRef = useRef(false)
  // "Tentar de novo" do índice (offline/falha): desligar e religar recomeça a carga do hook.
  const [indexOn, setIndexOn] = useState(true)
  const cmed = useCmedIndex({ enabled: indexOn, onLoaded: logIndexLoaded })
  // E-4: o callback dispara por quadro; só a 1ª leitura válida conta.
  const lockedRef = useRef(false)
  const reportedRef = useRef<string | null>(null)
  const { entryPoint, fromMedicineForm, purchase, scannedEanRef, close, goManual, returnDraft } = useScanReturn(navigation, route)

  const raw = toPermission(rawPermission)
  const permission = effectivePermission(isAndroid, raw, probe)
  const needsProbe = isAndroid && !!raw && !raw.granted && !raw.canAskAgain && probe === null

  // Pedido de câmera com a decisão negada × bloqueada (C-D1-5). Declarado antes dos effects: a
  // sondagem de entrada também o usa.
  const askCamera = useCallback(async () => {
    const startedAt = Date.now()
    const next = await requestPermission()
    const outcome = permissionOutcome(isAndroid, !!next?.granted, next?.canAskAgain !== false, Date.now() - startedAt)
    setProbe(outcome === 'granted' ? null : outcome)
    logEvent(EVENTS.SCAN_PERMISSION, { surface: SURFACES.MOBILE, result: outcome })
  }, [requestPermission, isAndroid])
  const screen = scanScreenState(cmed.status, permission, local)
  const cameraOn = screen === 'reading' && isFocused && appActive
  const retryingIndex = !indexOn

  // Effects
  useEffect(() => {
    logEvent(EVENTS.SCAN_OPENED, { surface: SURFACES.MOBILE, entry_point: entryPoint })
  }, [entryPoint])

  useEffect(() => {
    // Volta dos Ajustes: o hook do Expo só lê a permissão ao montar — relê para sair do "bloqueada".
    const sub = AppState.addEventListener('change', (next) => {
      setAppActive(next === 'active')
      if (next === 'active') {
        getPermission?.()
        // Voltou sem ser encerrado (Android, ou iOS sem mudar nada): a marca não serve mais.
        clearScanResume()
      }
    })
    return () => sub?.remove?.()
  }, [getPermission])

  // Android: quem tocou em "Ler o código de barras" com a câmera aparentemente bloqueada recebe o
  // pedido do sistema, que no modo "Perguntar sempre" aparece; se não aparecer, aí sim é bloqueio.
  useEffect(() => {
    if (!needsProbe || probingRef.current) return
    probingRef.current = true
    askCamera()
  }, [needsProbe, askCamera])

  // Timeout de ilegível: conta só enquanto a câmera está de fato lendo.
  useEffect(() => {
    if (!cameraOn) return undefined
    const timer = setTimeout(() => dispatch({ type: 'timeout' }), ILLEGIBLE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [cameraOn])

  useEffect(() => {
    const result = REPORTED_RESULTS[screen]
    if (!result || reportedRef.current === result) return
    reportedRef.current = result
    logEvent(EVENTS.SCAN_RESULT, { surface: SURFACES.MOBILE, result })
  }, [screen])

  // Handlers
  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (lockedRef.current || !cmed.index || !cmed.lookup) return
      lockedRef.current = true
      const ean = String(data ?? '').trim()
      scannedEanRef.current = ean
      const resolution = resolveScannedEan(cmed.index, cmed.lookup, ean)
      const result = resolution.kind === 'choose' ? 'multiple' : resolution.kind
      logEvent(EVENTS.SCAN_RESULT, { surface: SURFACES.MOBILE, result })
      selectionTap()
      if (resolution.kind === 'found') returnDraft(resolution.draft)
      else if (resolution.kind === 'choose') dispatch({ type: 'choose', title: resolution.title, options: resolution.options })
      else dispatch({ type: 'not_found' })
    },
    [cmed.index, cmed.lookup, returnDraft, scannedEanRef],
  )

  const handlePick = useCallback(
    (rowIdx: number) => {
      if (!cmed.index) return
      returnDraft(draftFromPick(cmed.index, rowIdx, true))
    },
    [cmed.index, returnDraft],
  )

  const retry = useCallback(() => {
    lockedRef.current = false
    reportedRef.current = null
    dispatch({ type: 'retry' })
  }, [])

  const retryIndex = useCallback(() => {
    reportedRef.current = null
    // Desliga agora e religa no próximo tick: o hook vê `enabled` mudar e recomeça a carga.
    setIndexOn(false)
    setTimeout(() => setIndexOn(true), 0)
  }, [])

  // Ação do estado de tela cheia: pedir câmera, Ajustes, recarregar o índice ou a loja (E10).
  const handleFullAction = useCallback(async () => {
    if (screen === 'offline') {
      retryIndex()
      return
    }
    if (screen === 'version') {
      await Linking.openURL(STORE_FALLBACK_URLS[Platform.OS === 'android' ? 'android' : 'ios'])
      return
    }
    if (screen === 'blocked') {
      // C-D1-6: o iOS encerra o app ao mudar a permissão; a marca faz a próxima abertura voltar aqui.
      // A retomada sempre abre o cadastro (useScanResume): a compra não marca.
      if (!isAndroid && fromMedicineForm) await markScanResume(entryPoint)
      await Linking.openSettings()
      return
    }
    await askCamera()
  }, [askCamera, screen, retryIndex, isAndroid, entryPoint, fromMedicineForm])

  if (FULL_SCREENS.has(screen)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <FullStateScreen
          screen={screen as FullScreenState}
          onAction={handleFullAction}
          onManual={goManual}
          onClose={close}
          purchase={purchase}
        />
      </SafeAreaView>
    )
  }

  if (screen === 'choosing') {
    return <ChoosingStep local={local} onPick={handlePick} onSkip={goManual} onBack={retry} />
  }

  const sheet =
    screen === 'illegible' || screen === 'not_found' || screen === 'index_failed' ? (
      <VisorSheet
        screen={screen}
        onRetry={screen === 'index_failed' ? retryIndex : retry}
        onManual={goManual}
        purchase={purchase}
      />
    ) : null

  return (
    <SafeAreaView style={styles.safeDark} edges={['top', 'bottom']}>
      <ScannerVisor
        cameraOn={cameraOn}
        preparing={screen === 'preparing' || retryingIndex}
        torch={torch}
        onTorch={() => setTorch((on) => !on)}
        onBarcode={handleBarcode}
        onClose={close}
        onManual={goManual}
        sheet={sheet}
        purchase={purchase}
      />
    </SafeAreaView>
  )
}

const VISOR_BG = colors.neutral[900]
const VISOR_GLASS = 'rgba(15,23,42,0.6)'
const VISOR_GLASS_STRONG = 'rgba(15,23,42,0.7)'
const TORCH_ON_BG = 'rgba(255,255,255,0.25)'
const PREP_TRACK = '#334155'
const PREP_TEXT = '#e2e8f0'

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  safeDark: {
    flex: 1,
    backgroundColor: VISOR_BG,
  },
  visor: {
    flex: 1,
    backgroundColor: VISOR_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visorTop: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  visorActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: VISOR_GLASS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchButton: {
    width: 'auto',
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  torchOn: {
    backgroundColor: TORCH_ON_BG,
  },
  torchText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  frameFocusing: {
    borderColor: colors.status.warningBright,
  },
  frame: {
    width: '80%',
    height: 150,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.text.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prepBox: {
    width: '70%',
    alignItems: 'center',
    gap: spacing[2],
  },
  prepTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: PREP_TRACK,
    overflow: 'hidden',
  },
  prepFill: {
    width: '60%',
    height: '100%',
    backgroundColor: colors.text.inverse,
  },
  prepText: {
    fontSize: 13,
    color: PREP_TEXT,
  },
  hintText: {
    marginTop: spacing[5],
    marginHorizontal: spacing[6],
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    color: colors.text.inverse,
    textAlign: 'center',
  },
  visorBottom: {
    position: 'absolute',
    left: spacing[5],
    right: spacing[5],
    bottom: spacing[6],
    borderRadius: 16,
    backgroundColor: VISOR_GLASS_STRONG,
  },
  choosing: {
    flex: 1,
    padding: spacing[4],
  },
})
