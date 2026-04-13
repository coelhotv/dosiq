import { SafeAreaProvider } from 'react-native-safe-area-context'
import Navigation from './Navigation'

// AppRoot — ponto de entrada da árvore de componentes
// SafeAreaProvider garante margens corretas em iPhones com notch e Android com barra de status
export default function AppRoot() {
  return (
    <SafeAreaProvider>
      <Navigation />
    </SafeAreaProvider>
  )
}
