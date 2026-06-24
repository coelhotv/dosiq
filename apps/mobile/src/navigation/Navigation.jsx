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
import { View, ActivityIndicator, Linking, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
// ADR-036: JS stack (não native-stack) — native-stack crasha na API 24
// (rnscreens 4.11.1 IndexOutOfBoundsException) ao desmontar a árvore no
// SIGNED_OUT. RootTabs/ProfileStack já são JS; o root era o último outlier.
import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from './routes'
import { navigationRef } from './navigationRef'
import SmokeScreen from '../screens/SmokeScreen'
import LoginScreen from '../screens/LoginScreen'
import LandingScreen from '../screens/LandingScreen'
import SignupScreen from '../screens/SignupScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import ResetPasswordScreen from '../screens/ResetPasswordScreen'
import RootTabs from './RootTabs'
import AlarmFullScreen from '../features/dose/screens/AlarmFullScreen'
import ChatScreen from '../features/chatbot/screens/ChatScreen'
import DevHubScreen from '../features/_dev/screens/DevHubScreen'
import StockPrimitivesDemoScreen from '../features/_dev/screens/StockPrimitivesDemoScreen'
import DosePrimitivesDemoScreen from '../features/_dev/screens/DosePrimitivesDemoScreen'
import OnboardingNavigator from '../features/onboarding/OnboardingNavigator'
import { isOnboardingNeeded } from '../features/profile/services/profileService'
import { supabase } from '../platform/supabase/nativeSupabaseClient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePushNotifications } from '../platform/notifications/usePushNotifications'
import { logScreenView } from '../platform/analytics/firebaseAnalytics'
import { debugLog } from '@shared/utils/debugLog'

const Stack = createStackNavigator()

function useAuthSession() {
  const [session, setSession] = useState(undefined)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [onboardingNeeded, setOnboardingNeeded] = useState(false)

  // Setup push notifications pós-login (H6.3)
  // Setup push register-only: nunca pede permissão (isso é dos pontos de intenção
  // - onboarding/criação de tratamento/configs). Só registra token se já concedido.
  usePushNotifications({ supabase, session })

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
      const isRecoveryFlow = await AsyncStorage.getItem('@dosiq/recovery-flow')
      if (event === 'PASSWORD_RECOVERY' || isRecoveryFlow === 'true') {
        await AsyncStorage.removeItem('@dosiq/recovery-flow')
        setIsPasswordRecovery(true)
        setSession(s ?? null)
        return
      }

      try {
        const isRecoveryFlow = await AsyncStorage.getItem('@dosiq/recovery-flow')
        if (isRecoveryFlow === 'true') {
          await AsyncStorage.removeItem('@dosiq/recovery-flow')
          setIsPasswordRecovery(true)
          setSession(s ?? null)
          return
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro ao acessar AsyncStorage no fluxo de recuperação:', error)
        }
      }

      if (event === 'SIGNED_OUT') {
        debugLog('Navigation', 'User signed out, clearing caches...')
        try {
          await AsyncStorage.multiRemove([
            '@dosiq/today-snapshot',
            '@dosiq/treatments-snapshot',
            '@dosiq/stock-snapshot'
          ])
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Erro ao limpar caches no logout:', error)
          }
        }
      }
      setSession(s ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Gate de primeiro acesso: ao ganhar sessão, decide wizard vs app. Os
  // setState síncronos aqui são intencionais (estado de verificação do gate).
  useEffect(() => {
    let active = true
    if (session?.user?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboardingNeeded(null) // verificando → spinner
      isOnboardingNeeded().then(({ data }) => {
        if (active) setOnboardingNeeded(Boolean(data))
      })
    } else {
      setOnboardingNeeded(false)
    }
    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    async function handleDeepLink({ url }) {
      if (!url) return

      // PKCE flow: dosiq://auth/callback?code=xxxxx
      // AP-139: Object.fromEntries(URLSearchParams) quebra no Hermes — usar .get()
      const queryString = url.split('?')[1]?.split('#')[0]
      if (queryString) {
        const sp = new URLSearchParams(queryString)
        const code = sp.get('code')
        const type = sp.get('type')
        if (code) {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) {
              debugLog('Navigation', 'exchangeCodeForSession falhou', error.message)
            } else if (type === 'recovery') {
              setIsPasswordRecovery(true) // Apenas desvia para redefinir senha se o tipo for recovery
            }
          } catch (e) {
            debugLog('Navigation', 'Exceção em exchangeCodeForSession', e?.message)
          }
          return
        }
      }

      // Implicit flow: dosiq://auth/callback#access_token=...&refresh_token=...&type=recovery|signup
      const hash = url.split('#')[1]
      if (!hash) return
      const sp = new URLSearchParams(hash)
      const tokenType = sp.get('type')
      const accessToken = sp.get('access_token')
      const refreshToken = sp.get('refresh_token')
      if (accessToken && refreshToken && (tokenType === 'recovery' || tokenType === 'signup')) {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            debugLog('Navigation', `setSession ${tokenType} falhou`, error.message)
          } else if (tokenType === 'recovery') {
            setIsPasswordRecovery(true) // recovery → tela de redefinir senha
          }
          // signup: setSession dispara SIGNED_IN → app abre logado (gate de onboarding)
        } catch (e) {
          debugLog('Navigation', `Exceção em setSession ${tokenType}`, e?.message)
        }
      }
    }
    Linking.getInitialURL()
      .then((url) => { if (url) handleDeepLink({ url }) })
      .catch((err) => debugLog('Navigation', 'getInitialURL falhou', err?.message))
    const sub = Linking.addEventListener('url', handleDeepLink)
    return () => sub.remove()
  }, [])

  return {
    session,
    setSession,
    isPasswordRecovery,
    setIsPasswordRecovery,
    onboardingNeeded,
    setOnboardingNeeded,
  }
}

export default function Navigation() {
  const {
    session,
    isPasswordRecovery,
    setIsPasswordRecovery,
    onboardingNeeded,
    setOnboardingNeeded,
  } = useAuthSession()

  // Handler para rastrear mudanças de tela — getCurrentRoute é mais robusto com nested navigators
  const handleNavigationStateChange = () => {
    const routeName = navigationRef.current?.getCurrentRoute?.()?.name
    if (routeName) {
      logScreenView(routeName)
    }
  }

  // Aguarda verificação inicial — evita flash de ecrã errado.
  // Também aguarda o gate de onboarding resolver quando há sessão.
  if (session === undefined || (session && !isPasswordRecovery && onboardingNeeded === null)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  // Um único NavigationContainer (ref compartilhada). O filho alterna entre o
  // wizard de onboarding (1º acesso sem dados) e o app — dois containers com a
  // mesma ref disparavam "navigation hasn't been initialized" na troca.
  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={handleNavigationStateChange}
    >
      {session && !isPasswordRecovery && onboardingNeeded ? (
        <OnboardingNavigator onComplete={() => setOnboardingNeeded(false)} />
      ) : (
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
            {/* Alarme em tela cheia (Spec 001) — takeover, sem header nem gesto de voltar */}
            <Stack.Screen
              name={ROUTES.ALARM_FULLSCREEN}
              component={AlarmFullScreen}
              options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
            />
            {/* Chat IA full-screen (spec 015 onda 2) — header próprio na tela */}
            <Stack.Screen name={ROUTES.CHAT} component={ChatScreen} />
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
                <Stack.Screen
                  name={ROUTES.DOSE_PRIMITIVES_DEMO}
                  component={DosePrimitivesDemoScreen}
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
      )}
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
