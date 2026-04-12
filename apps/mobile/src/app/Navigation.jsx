import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ROUTES } from './routes'
import SmokeScreen from '../screens/SmokeScreen'
import LoginScreen from '../screens/LoginScreen'
import HomeScreen from '../screens/HomeScreen'

const Stack = createNativeStackNavigator()

// Navegação mínima da Fase 4: Smoke + Login + Home
// Tabs do produto entram na Fase 5 (R4-005: smoke primeiro, produto depois)
export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={ROUTES.SMOKE}>
        <Stack.Screen
          name={ROUTES.SMOKE}
          component={SmokeScreen}
          options={{ title: 'Smoke Test' }}
        />
        <Stack.Screen
          name={ROUTES.LOGIN}
          component={LoginScreen}
          options={{ title: 'Entrar' }}
        />
        <Stack.Screen
          name={ROUTES.HOME}
          component={HomeScreen}
          options={{ title: 'Início' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
