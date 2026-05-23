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
import DevHubScreen from '../features/_dev/screens/DevHubScreen'
import StockPrimitivesDemoScreen from '../features/_dev/screens/StockPrimitivesDemoScreen'
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
    async function handleDeepLink({ url }) {
      if (!url) return

      // PKCE flow: dosiq://auth/callback?code=xxxxx
      // AP-139: Object.fromEntries(URLSearchParams) quebra no Hermes — usar .get()
      const queryString = url.split('?')[1]?.split('#')[0]
      if (queryString) {
        const code = new URLSearchParams(queryString).get('code')
        if (code) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) debugLog('Navigation', 'exchangeCodeForSession falhou', error.message)
            else setIsPasswordRecovery(true) // dispara SIGNED_IN, não PASSWORD_RECOVERY
          } catch (e) {
            debugLog('Navigation', 'Exceção em exchangeCodeForSession', e?.message)
          }
          return
        }
      }

      // Implicit flow: dosiq://auth/callback#access_token=...&refresh_token=...&type=recovery
      const hash = url.split('#')[1]
      if (!hash) return
      const sp = new URLSearchParams(hash)
      const tokenType = sp.get('type')
      const accessToken = sp.get('access_token')
      const refreshToken = sp.get('refresh_token')
      if (tokenType === 'recovery' && accessToken && refreshToken) {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) debugLog('Navigation', 'setSession recovery falhou', error.message)
          else setIsPasswordRecovery(true) // dispara SIGNED_IN, não PASSWORD_RECOVERY
        } catch (e) {
          debugLog('Navigation', 'Exceção em setSession recovery', e?.message)
        }
      }
    }
    Linking.getInitialURL()
      .then((url) => { if (url) handleDeepLink({ url }) })
      .catch((err) => debugLog('Navigation', 'getInitialURL falhou', err?.message))
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
          <>
            <Stack.Screen name={ROUTES.TABS} component={RootTabs} />
            {__DEV__ && (
              <>
                <Stack.Screen
                  name={ROUTES.DEV_HUB}
                  component={DevHubScreen}
                />
                <Stack.Screen
                  name={ROUTES.STOCK_PRIMITIVES_DEMO}
                  component={StockPrimitivesDemoScreen}
                />
              </>
            )}
          </>
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
