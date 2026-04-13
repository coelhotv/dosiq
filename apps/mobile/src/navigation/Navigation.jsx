// Navigation.jsx — navegação auth-aware do app mobile
// R-164 (AP-H10): 3 estados obrigatórios (undefined/null/session)
//   undefined = a verificar sessão → spinner
//   null      = sem sessão         → LOGIN
//   object    = sessão activa      → TABS (shell do produto)
//
// CRÍTICO: NÃO simplificar — SecureStore chunked é assíncrono;
//   se montarmos o Navigator antes de getSession() resolver,
//   o utilizador sempre vê LOGIN mesmo com sessão válida guardada.

import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ROUTES } from './routes'
import SmokeScreen from '../screens/SmokeScreen'
import LoginScreen from '../screens/LoginScreen'
import RootTabs from './RootTabs'
import { supabase } from '../platform/supabase/nativeSupabaseClient'

const Stack = createNativeStackNavigator()

export default function Navigation() {
  // undefined = a verificar; null = sem sessão; object = sessão activa
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // Restaurar sessão persistida (SecureStore chunked — R-160)
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
      <Stack.Navigator
        initialRouteName={session ? ROUTES.TABS : ROUTES.LOGIN}
        screenOptions={{ headerShown: false }}
      >
        {/* Ecrã de diagnóstico — acessível internamente */}
        <Stack.Screen
          name={ROUTES.SMOKE}
          component={SmokeScreen}
          options={{ headerShown: true, title: 'Smoke Test' }}
        />
        {/* Auth */}
        <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
        {/* Shell do produto (tabs) */}
        <Stack.Screen name={ROUTES.TABS} component={RootTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
