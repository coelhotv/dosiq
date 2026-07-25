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
import { AppState, View, ActivityIndicator, Linking, StyleSheet } from 'react-native'
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
import StockInitialBalanceScreen from '../features/stock/screens/StockInitialBalanceScreen'
import DevHubScreen from '../features/_dev/screens/DevHubScreen'
import StockPrimitivesDemoScreen from '../features/_dev/screens/StockPrimitivesDemoScreen'
import DosePrimitivesDemoScreen from '../features/_dev/screens/DosePrimitivesDemoScreen'
import MedicineFormScreen from '../features/medications/screens/MedicineFormScreen'
import OnboardingNavigator from '../features/onboarding/OnboardingNavigator'
import ConsentResolutionScreen from '../features/consent/screens/ConsentResolutionScreen'
import ConsentPrompt from '../features/consent/components/ConsentPrompt'
import ConsentRegularizationSheet from '../features/consent/components/ConsentRegularizationSheet'
import PrivacyDataScreen from '../features/profile/screens/PrivacyDataScreen'
import DeleteAccountScreen from '../features/profile/screens/DeleteAccountScreen'
import { ConsentGateProvider, useConsentGate } from '../platform/consent/useConsentGate'
import { isOnboardingNeeded } from '../features/profile/services/profileService'
import { supabase } from '../platform/supabase/nativeSupabaseClient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePushNotifications } from '../platform/notifications/usePushNotifications'
import { syncDeviceActivity } from '../platform/telemetry/syncDeviceActivity'
import { StockTrackingProvider } from '@shared/hooks/useStockTracking'
import { logScreenView, setUserId, resetUser } from '../platform/analytics/productAnalytics'
import { debugLog } from '@shared/utils/debugLog'

// TODO(040-strict): createStackNavigator<any>() — sem ParamList tipada, overload exige `id`
const Stack = createStackNavigator<any>()

function useAuthSession() {
  const [session, setSession] = useState(undefined)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [onboardingNeeded, setOnboardingNeeded] = useState(false)

  // Setup push notifications pós-login (H6.3)
  // Setup push register-only: nunca pede permissão (isso é dos pontos de intenção
  // - onboarding/criação de tratamento/configs). Só registra token se já concedido.
  usePushNotifications({ supabase, session })

  // Identificação de usuário no PostHog/Sentry (ADR-090). AQUI, e não no LoginScreen: este efeito
  // roda tanto no login novo quanto na sessão RESTAURADA do SecureStore — que é como o usuário
  // entra no dia a dia. Identificar só no login explícito deixava o uso recorrente anônimo, e cada
  // device virava uma pessoa distinta no dashboard, inflando a contagem de usuários.
  useEffect(() => {
    if (!session?.user?.id) return
    setUserId(session.user.id)
  }, [session?.user?.id])

  // Heartbeat de atividade (spec 057 / ADR-089): independente de push (R-239 intocada — nunca
  // pede permissão nenhuma), roda em cold start e em toda volta a foreground; o throttle de 24h
  // por device fica dentro de syncDeviceActivity (best-effort, nunca lança).
  useEffect(() => {
    if (!session?.user?.id) return

    syncDeviceActivity({ supabase })

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncDeviceActivity({ supabase })
      }
    })
    return () => subscription.remove()
  }, [session?.user?.id])

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
        // Encerra a identificação ANTES de limpar cache: a partir daqui os eventos voltam a ser
        // anônimos. Sem isto, quem logar depois neste device herdaria a pessoa anterior.
        resetUser()
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

/**
 * TRAVA DO CONSENTIMENTO — allowlist ESTRUTURAL (spec 046, T009 / R2 / F8).
 *
 * Com o app travado, o navigator registra SÓ estas telas. Não é uma checagem que alguém pode
 * esquecer de escrever: a rota fora desta lista literalmente NÃO EXISTE enquanto a trava está de
 * pé. Uma denylist faria o oposto — bastaria esquecer uma rota para o titular revogado ficar preso
 * numa tela sem export e sem exclusão, justamente os direitos que a revogação deveria tornar MAIS
 * acessíveis, não menos. Aqui, rota nova nasce trancada, e liberar é um ato deliberado.
 */
function ConsentLockedNavigator({ mode, onGrant, onGranted }) {
  return (
    <Stack.Navigator id="ConsentLockedStack" screenOptions={{ headerShown: false }}>
      {mode === 'blocked_revoked' ? (
        <Stack.Screen name={ROUTES.CONSENT_RESOLUTION} component={ConsentResolutionScreen} />
      ) : (
        <Stack.Screen name={ROUTES.CONSENT_RESOLUTION}>
          {() => <ConsentPrompt blocking onGrant={onGrant} onGranted={onGranted} />}
        </Stack.Screen>
      )}
      {/* Hub do 008: export + política + exclusão. É esta rota que sustenta o anti-deadlock.
          headerShown:false — ambas as telas trazem header próprio (SafeAreaView + linha de voltar);
          o header nativo empilharia por cima e viraria header duplo. */}
      <Stack.Screen
        name={ROUTES.PRIVACY_DATA}
        component={PrivacyDataScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={ROUTES.DELETE_ACCOUNT}
        component={DeleteAccountScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  )
}

export default function Navigation() {
  const auth = useAuthSession()
  // ConsentGateProvider ENVOLVE a árvore: assim o guard raiz (NavigationTree) e o card do hub
  // (PrivacyConsentSection, lá dentro) leem o MESMO estado. Revogar no card chama refresh do MESMO
  // gate → a trava aparece na hora, sem esperar o próximo foreground.
  return (
    <ConsentGateProvider session={auth.session}>
      <NavigationTree {...auth} />
    </ConsentGateProvider>
  )
}

function NavigationTree({
  session,
  isPasswordRecovery,
  setIsPasswordRecovery,
  onboardingNeeded,
  setOnboardingNeeded,
}: ReturnType<typeof useAuthSession>) {
  const consent = useConsentGate()
  // Nudge de política nova (`stale`) dispensável por sessão — fechar não escreve nada (T011).
  const [regularizationDismissed, setRegularizationDismissed] = useState(false)

  // Handler para rastrear mudanças de tela — getCurrentRoute é mais robusto com nested navigators
  const handleNavigationStateChange = () => {
    // TODO(040-strict): navigationRef sem ParamList tipada — never no generic ref
    const routeName = (navigationRef.current as any)?.getCurrentRoute?.()?.name
    if (routeName) {
      logScreenView(routeName)
    }
  }

  // Aguarda verificação inicial — evita flash de ecrã errado.
  // Também aguarda o gate de onboarding e o de consentimento resolverem quando há sessão.
  const consentPending = Boolean(session) && !isPasswordRecovery && !consent.ready
  if (session === undefined || (session && !isPasswordRecovery && onboardingNeeded === null) || consentPending) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  // INDETERMINADO — não conseguimos LER a trilha de consentimento (ex.: offline, contrato do Slice A).
  // NÃO libera NEM bloqueia por si só (`locked: false`): é falha de carregamento, não um fato sobre a
  // vontade do titular. O dosiq é offline-first — navegar doses/estoque sem rede é valor de produto
  // prometido nas landings —, então sob indeterminação o app RENDERIZA normalmente e NÃO trava numa
  // tela de erro. A trava real (revogado → blocked) é reaplicada quando a rede volta: o listener de
  // `AppState 'active'` chama `refresh()` e reavalia o gate.
  //
  // Segurança preservada: indeterminação NÃO escreve nada e NÃO conta sessão de prompt — tratá-la como
  // `missing` é que ressuscitaria, na materialização, um consentimento REVOGADO numa oscilação de rede
  // (furo HIGH do review do Slice A). Essa proteção mora na LEITURA (hook → `state: null`), não em
  // barrar a renderização. Renderizar offline não materializa consentimento algum.

  // O gate do consentimento vem ANTES do onboarding: quem nunca consentiu não pode ser levado ao
  // wizard, que existe justamente para começar a gerar dado de saúde.
  const consentLocked = Boolean(session) && !isPasswordRecovery && consent.locked
  const showDismissiblePrompt =
    Boolean(session) &&
    !isPasswordRecovery &&
    consent.mode === 'prompt_dismissible' &&
    !consent.dismissed

  // Nudge de regularização: consentiu numa política ANTIGA (`stale`, mode 'allow' → não trava).
  // Overlay dispensável por cima do app, como o prompt dispensável.
  const showRegularization =
    Boolean(session) &&
    !isPasswordRecovery &&
    consent.needsRegularization &&
    !regularizationDismissed

  // Um único NavigationContainer (ref compartilhada). O filho alterna entre o
  // wizard de onboarding (1º acesso sem dados) e o app — dois containers com a
  // mesma ref disparavam "navigation hasn't been initialized" na troca.
  return (
    <StockTrackingProvider session={session}>
    <View style={styles.flex}>
    <NavigationContainer
      ref={navigationRef}
      onStateChange={handleNavigationStateChange}
    >
      {consentLocked ? (
        <ConsentLockedNavigator
          mode={consent.mode}
          onGrant={consent.grant}
          onGranted={() => consent.refresh()}
        />
      ) : session && !isPasswordRecovery && onboardingNeeded ? (
        <OnboardingNavigator onComplete={() => setOnboardingNeeded(false)} />
      ) : (
      <Stack.Navigator
        id="RootStack"
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
              options={{ presentation: 'modal', gestureEnabled: false }}
            />
            {/* Chat IA full-screen (spec 015 onda 2) — header próprio na tela */}
            <Stack.Screen name={ROUTES.CHAT} component={ChatScreen} />
            {/* Saldo inicial da ativação do estoque (spec 044, F4b/T017) — mora no stack RAIZ,
                não no ProfileStack: as entradas vêm de abas DIFERENTES (upsell na Hoje, toggle no
                Perfil) e stacks irmãos não se enxergam — `navigate` só sobe pela cadeia de pais.
                Registrada aqui, qualquer aba alcança. (O onboarding tem a sua própria rota, no
                navigator dele.) */}
            <Stack.Screen
              name={ROUTES.STOCK_INITIAL_BALANCE}
              component={StockInitialBalanceScreen}
            />
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
                {/* Spec 055 PR 1.4: MedicineFormScreen SEM tab bar (root stack) — permite
                    validar safe-area/FormActions isolado, sem depender de onboarding novo
                    nem de conta em consent-locked. Modo create (sem params). */}
                <Stack.Screen
                  name={ROUTES.DEV_FORM_NO_TABBAR}
                  component={MedicineFormScreen}
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

    {/* Prompt dispensável (até a 3ª sessão): overlay POR CIMA do app, com saída. Da 4ª em diante
        ele vira tela bloqueante e sai daqui — passa a ser o ConsentLockedNavigator. */}
    {showDismissiblePrompt && (
      <View style={styles.promptOverlay}>
        <ConsentPrompt
          blocking={false}
          onGrant={consent.grant}
          onDismiss={consent.dismiss}
          onGranted={() => consent.refresh()}
        />
      </View>
    )}

    {/* Nudge de política nova (stale): Modal próprio, flutua sobre o app. Aceitar carimba a versão
        vigente (o Sheet chama grant internamente) → refresh reavalia o gate e some o stale. */}
    <ConsentRegularizationSheet
      visible={showRegularization}
      onDismiss={() => setRegularizationDismissed(true)}
      onConfirmed={() => { setRegularizationDismissed(true); consent.refresh() }}
    />
    </View>
    </StockTrackingProvider>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },
})
