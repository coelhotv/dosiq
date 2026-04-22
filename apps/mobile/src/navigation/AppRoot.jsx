import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency'
import Navigation from './Navigation'

// AppRoot — ponto de entrada da árvore de componentes
// SafeAreaProvider garante margens corretas em iPhones com notch e Android com barra de status
export default function AppRoot() {
  useEffect(() => {
    (async () => {
      // Dispara o pedido de permissão nativo do iOS (ATT)
      const { status } = await requestTrackingPermissionsAsync()
      if (status === 'granted') {
        console.log('[Tracking] Permissão concedida pelo usuário.')
      }
    })()
  }, [])

  return (
    <SafeAreaProvider>
      <Navigation />
    </SafeAreaProvider>
  )
}
