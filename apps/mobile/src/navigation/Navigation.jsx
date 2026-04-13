import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ROUTES } from './routes'
import SmokeScreen from '../screens/SmokeScreen'
// DEBUG: LoginScreen e HomeScreen removidos temporariamente
// para isolar se o crash vem de nativeSupabaseClient (singleton de módulo)
// import LoginScreen from '../screens/LoginScreen'
// import HomeScreen from '../screens/HomeScreen'

const Stack = createNativeStackNavigator()

export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={ROUTES.SMOKE}>
        <Stack.Screen
          name={ROUTES.SMOKE}
          component={SmokeScreen}
          options={{ title: 'Smoke Test' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
