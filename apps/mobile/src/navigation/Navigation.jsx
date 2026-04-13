import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ROUTES } from './routes'
import SmokeScreen from '../screens/SmokeScreen'
import LoginScreen from '../screens/LoginScreen'
import HomeScreen from '../screens/HomeScreen'
import { supabase } from '../platform/supabase/nativeSupabaseClient'

const Stack = createNativeStackNavigator()

// Auth-aware navigation: verifica sessão no arranque
// Se sessão existe → Home directo; se não → SmokeScreen → Login
export default function Navigation() {
  // undefined = a verificar; null = sem sessão; object = sessão activa
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // Restaurar sessão persistida
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null)
    })

    // Actualizar em tempo real quando auth muda (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Aguarda verificação inicial — evita flash de ecrã errado
  if (session === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={session ? ROUTES.HOME : ROUTES.SMOKE}>
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
