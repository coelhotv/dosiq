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
import { View, ActivityIndicator, Linking } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ROUTES } from './routes'
import { navigationRef } from './navigationRef'
import SmokeScreen from '../screens/SmokeScreen'
import LoginScreen from '../screens/LoginScreen'
import LandingScreen from '../screens/LandingScreen'
import SignupScreen from '../screens/SignupScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import ResetPasswordScreen from '../screens/ResetPasswordScreen'
import RootTabs from './RootTabs'
import { supabase } from '../platform/supabase/nativeSupabaseClient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePushNotifications } from '../platform/notifications/usePushNotifications'
import { logScreenView } from '../platform/analytics/firebaseAnalytics'
import { debugLog } from '@shared/utils/debugLog'

const Stack = createNativeStackNavigator()

export default function Navigation() {
  // undefined = a verificar; null = sem sessão; object = sessão activa
  const [session, setSession] = useState(undefined)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // Setup push notifications pós-login (H6.3)
  usePushNotifications({ supabase, session })

  // Handler para rastrear mudanças de tela — getCurrentRoute é mais robusto com nested navigators
  const handleNavigationStateChange = () => {
    const routeName = navigationRef.current?.getCurrentRoute?.()?.name
    if (routeName) {
      logScreenView(routeName)
    }
  }

  useEffect(() => {
    // Restaurar sessão persistida (SecureStore chunked — R-160)
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s ?? null)
      })
      .catch((error) => {
        console.error('Erro ao restaurar sessão:', error)
        setSession(null) // null = sem sessão → redirige para LOGIN
      })

    // Actualizar em tempo real quando auth muda (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setSession(s ?? null)
        return
      }
      if (event === 'SIGNED_OUT') {
        debugLog('Navigation', 'User signed out, clearing caches...')
        await AsyncStorage.multiRemove([
          '@dosiq/today-snapshot',
          '@dosiq/treatments-snapshot',
          '@dosiq/stock-snapshot'
        ])
      }
      setSession(s ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleDeepLink({ url }) {
      if (!url) return
      const hash = url.split('#')[1]
      if (!hash) return
      const params = Object.fromEntries(new URLSearchParams(hash))
      if (params.type === 'recovery' && params.access_token && params.refresh_token) {
        supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        })
      }
    }
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }) })
    const sub = Linking.addEventListener('url', handleDeepLink)
    return () => sub.remove()
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
    <NavigationContainer
      ref={navigationRef}
      onStateChange={handleNavigationStateChange}
    >
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
      >
        {isPasswordRecovery ? (
          <Stack.Screen
            name={ROUTES.RESET_PASSWORD}
            component={ResetPasswordScreen}
            initialParams={{ onComplete: () => setIsPasswordRecovery(false) }}
          />
        ) : session ? (
          <Stack.Screen name={ROUTES.TABS} component={RootTabs} />
        ) : (
          <>
            <Stack.Screen name={ROUTES.LANDING} component={LandingScreen} />
            <Stack.Screen name={ROUTES.LOGIN} component={LoginScreen} />
            <Stack.Screen name={ROUTES.SIGNUP} component={SignupScreen} />
            <Stack.Screen name={ROUTES.FORGOT_PASSWORD} component={ForgotPasswordScreen} />
            <Stack.Screen
              name={ROUTES.SMOKE}
              component={SmokeScreen}
              options={{ headerShown: true, title: 'Smoke Test' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
