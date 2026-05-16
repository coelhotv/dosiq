import { useEffect } from 'react'
import { AppState } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } from 'expo-tracking-transparency'
import analytics from '@react-native-firebase/analytics'
import Navigation from './Navigation'
import { ToastProvider } from '@shared/components/feedback/Toast'
import ErrorBoundary from '@shared/components/ErrorBoundary'
import { debugLog } from '@shared/utils/debugLog'
import {
  useFonts,
  Comfortaa_400Regular,
  Comfortaa_700Bold
} from '@expo-google-fonts/comfortaa'

// Captura timestamp no top-level do módulo (antes do React montar).
// Usado para medir cold start (time from JS load → first effect).
const APP_START_TS = Date.now()

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
    analytics().logEvent('cold_start', { duration_ms: launchMs }).catch(() => {
      // silenciar — analytics não deve quebrar o app
    })
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

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ToastProvider>
          <Navigation />
        </ToastProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}
