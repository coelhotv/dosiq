import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency'
import * as Sentry from '@sentry/react-native'
import { PostHogProvider } from 'posthog-react-native'
import Navigation from './Navigation'
import { logEvent, getPostHogClient } from '@platform/analytics/productAnalytics'
import { sentryDsn } from '@platform/config/nativePublicAppConfig'
import { ToastProvider } from '@shared/components/feedback/Toast'
import ErrorBoundary from '@shared/components/ErrorBoundary'
import AlarmSchedulerBridge from '@platform/alarms/AlarmSchedulerBridge'
import DoseActivityBridge from '@platform/doseActivity/DoseActivityBridge'
import DoseLiveActivityBridge from '@platform/doseActivity/DoseLiveActivityBridge'
import { debugLog } from '@shared/utils/debugLog'
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold
} from '@expo-google-fonts/comfortaa'

// Captura timestamp no top-level do módulo (antes do React montar).
// Usado para medir cold start (time from JS load → first effect).
const APP_START_TS = Date.now()

// ADR-090: crash reporting = Sentry (substitui Crashlytics). Init no topo do módulo, antes de
// qualquer render, para capturar erro de boot. Sem DSN configurado → não inicializa (no-op).
// Fail-silent por design: observabilidade nunca pode impedir o app de subir.
if (sentryDsn) {
  try {
    Sentry.init({
      dsn: sentryDsn,
      // Só o essencial: crash + erro. Sem tracing/replay (custo e cota).
      tracesSampleRate: 0,
      enableAutoSessionTracking: true,
      // __DEV__ também reporta — útil p/ validar o pipeline no smoke.
      debug: false,
    })
  } catch {
    // ignora — Sentry indisponível não pode quebrar o boot
  }
}

// AppRoot — ponto de entrada da árvore de componentes
export default function AppRoot() {
  const [fontsLoaded] = useFonts({
    'Comfortaa-Regular': Comfortaa_400Regular,
    'Comfortaa-Bold': Comfortaa_700Bold,
  })

  // Cold start telemetry — dispara 1x quando fontes carregam (app interativo).
  useEffect(() => {
    if (!fontsLoaded) return
    const launchMs = Date.now() - APP_START_TS
    if (__DEV__) debugLog(`[perf] cold_start: ${launchMs}ms`)
    // logEvent (wrapper PostHog) já é fail-silent por contrato (CON-021).
    logEvent('cold_start', { duration_ms: launchMs })
  }, [fontsLoaded])

  useEffect(() => {
    let isRequesting = false

    const requestTracking = async () => {
      // Evita chamadas duplicadas simultâneas
      if (isRequesting) return
      isRequesting = true

      try {
        // Verifica o status atual antes de pedir
        const { status: currentStatus } = await getTrackingPermissionsAsync()
        
        // Só pede se ainda não foi determinado (primeira vez)
        if (currentStatus === 'undetermined') {
          // Pequeno delay para garantir que a UI do sistema está pronta
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const { status } = await requestTrackingPermissionsAsync()
          debugLog(`[Tracking] Resultado da solicitação: ${status}`)
        }
      } catch (error) {
        if (__DEV__) console.warn('[Tracking] Falha ao solicitar permissão:', error)
      } finally {
        isRequesting = false
      }
    }

    // Tenta solicitar no mount inicial
    if (AppState.currentState === 'active') {
      requestTracking()
    }

    // Listener para garantir que se o app entrou em background e voltou, ou se o mount foi rápido demais
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        requestTracking()
      }
    })

    return () => subscription.remove()
  }, [])

  if (!fontsLoaded) {
    return null
  }

  const tree = (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <AlarmSchedulerBridge />
          {/* Superfície contínua por plataforma: Android = Notifee ongoing; iOS = Live Activity. */}
          {Platform.OS === 'android' && <DoseActivityBridge />}
          {Platform.OS === 'ios' && <DoseLiveActivityBridge />}
          <Navigation />
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )

  // PostHogProvider só entra quando há client (chave configurada) — sem chave, analytics é no-op
  // e o provider não deve montar. Autocapture DESLIGADO: as telas já são registradas
  // explicitamente por logScreenView (Navigation.tsx) e autocapture queimaria cota à toa.
  const posthog = getPostHogClient()
  if (!posthog) return tree

  return (
    <PostHogProvider client={posthog} autocapture={false}>
      {tree}
    </PostHogProvider>
  )
}
