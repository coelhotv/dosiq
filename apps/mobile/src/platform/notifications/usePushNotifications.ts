// Hook para setup de push notifications pós-login — REGISTER-ONLY.
// NUNCA pede permissão aqui (isso é dos pontos de intenção — ver pushPermission.js).
// Se a permissão já foi concedida, registra o token; senão, não faz nada.
// Configura handlers + tap listener (deeplink real via navigationRef).
// Cleanup automático em logout (via dependencies).

import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getPushPermissionStatus } from './pushPermission'
import { registerPushToken, PUSH_TOKEN_KEY } from './registerPushToken'
import { unregisterNotificationDevice } from './unregisterNotificationDevice'
import { ensurePushChannel } from './ensurePushChannel'
import { ensureTitrationCategories, handleTitrationNotificationAction, isTitrationAction } from './titrationNotificationActions'
import { navigationRef } from '../../navigation/navigationRef'
import { ROUTES } from '../../navigation/routes'
import { debugLog } from '@shared/utils/debugLog'

// Mapa de screen names do payload para rotas do navigator
const SCREEN_TO_ROUTE = {
  'bulk-plan': ROUTES.TODAY,
  'bulk-misc': ROUTES.TODAY,
  'dose-individual': ROUTES.TODAY,
  'history': ROUTES.DOSE_HISTORY,
}

// Navega para a tela correta a partir de um tap em push notification.
// No cold start o NavigationContainer pode não ter montado ainda — navegar
// antes dispara "navigation hasn't been initialized". Guard com isReady() +
// retry curto até o container montar.
// Recebe o `data` COMPLETO da notificação (não só `.navigation`) pra distinguir
// o alarme nativo de um push real.
function navigateFromPush(data) {
  // Alarme nativo (Notifee) tem doseInstanceId e é tratado por outro handler
  // (AlarmSchedulerBridge). Seu press chega aqui via expo-notifications no Android
  // (sistema de notif compartilhado) SEM `navigation` → o fallback antigo forçava
  // navigate('Hoje') no root e quebrava ("'Hoje' not handled" — aninhado em TABS).
  if (!data || data.doseInstanceId) return
  const navigationData = data.navigation
  const screen = navigationData?.screen
  const params = navigationData?.params ?? {}
  const targetRoute = (screen && SCREEN_TO_ROUTE[screen]) ?? ROUTES.TODAY
  const navParams = screen ? { screen, ...params } : params

  const go = () => {
    navigationRef.navigate(targetRoute, navParams)
    debugLog('[usePushNotifications] Navegando para:', targetRoute, 'params:', params)
  }

  if (navigationRef.isReady?.()) {
    go()
    return
  }
  // Aguarda o container montar (cold start) — desiste após ~5s.
  let waited = 0
  const interval = setInterval(() => {
    waited += 100
    if (navigationRef.isReady?.()) {
      clearInterval(interval)
      go()
    } else if (waited >= 5000) {
      clearInterval(interval)
    }
  }, 100)
}

export function usePushNotifications({ supabase, session }) {
  // Flag para garantir que o cold start seja processado apenas uma vez por ciclo de vida do app,
  // mesmo que o useEffect re-execute em logout+login sem fechar o app.
  const coldStartProcessed = useRef(false)

  useEffect(() => {
    if (!session || !supabase) return

    let isMounted = true

    // 🔴 REGISTRO SÍNCRONO, FORA do setup async (029 F5 — smoke do PO).
    // Antes o listener era criado DENTRO de `setupPush()`, depois de vários `await`. Quando o
    // efeito re-rodava (a identidade de `session` muda a cada refresh de token), o cleanup
    // executava com a variável ainda `undefined` → `remove()` virava no-op, e a execução antiga
    // seguia até registrar um listener que ninguém mais conseguia remover. Cada ciclo acumulava
    // mais um: o toque em [Iniciar etapa] disparava o handler N vezes (visto no log como
    // `already_confirmed` + `confirmed` no mesmo toque). Registrar aqui — a chamada é síncrona e
    // nunca precisou do await — garante que o cleanup SEMPRE tenha o handle.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // 029 F5: ação da Evolução do tratamento resolve em background e NÃO navega
        // (opensAppToForeground:false). Só o toque no CORPO cai no deeplink.
        // O guard é SÍNCRONO: a navegação das demais notificações não ganha um microtask
        // de atraso por causa desta feature.
        if (isTitrationAction(response)) {
          handleTitrationNotificationAction(response).catch(() => {})
          return
        }
        navigateFromPush(response.notification.request.content.data)
      }
    )

    async function setupPush() {
      try {
        // Canal Android com o som próprio do app (push_chime). No-op no iOS.
        await ensurePushChannel()

        // Cold start: processar resposta pendente apenas uma vez por ciclo de vida do app
        if (!coldStartProcessed.current) {
          coldStartProcessed.current = true
          const lastResponse = await Notifications.getLastNotificationResponseAsync()
          if (lastResponse && isMounted) {
            // MESMO guard do listener (RC5 do F5): a resposta pendente pode ser uma AÇÃO da
            // Evolução do tratamento — app morto + toque em [Iniciar etapa] chega por aqui, não
            // pelo listener. Sem o guard o app NAVEGA em vez de confirmar e a RPC nunca é
            // chamada: o toque some em silêncio, que é o oposto do Princípio IX.
            if (isTitrationAction(lastResponse)) {
              handleTitrationNotificationAction(lastResponse).catch(() => {})
            } else {
              navigateFromPush(lastResponse.notification.request.content.data)
            }
          }
        }

        // Categoria iOS das ações da Evolução do tratamento (029 F5). Sem ela o push do
        // medicine_switch chega SEM botões, em silêncio. No-op no Android. Idempotente.
        // DEPOIS do listener e com catch PRÓPRIO de propósito: é um enfeite de UMA feature, e
        // não pode derrubar o setup inteiro do push (deeplink + registro de token) se falhar.
        ensureTitrationCategories().catch((err) => {
          if (__DEV__) console.warn('[usePushNotifications] categoria de titulação falhou:', err?.message)
        })

        // REGISTER-ONLY: registra o token só se a permissão JÁ foi concedida.
        // NUNCA pedir aqui — o prompt é dos pontos de intenção (pushPermission.js).
        const { granted } = await getPushPermissionStatus()
        if (!granted) {
          debugLog('[usePushNotifications] Sem permissão — register-only, nada a fazer')
          return
        }
        if (!isMounted) return
        await registerPushToken({ supabase, userId: session.user.id })
      } catch (error) {
        if (isMounted && __DEV__) {
          console.warn('[usePushNotifications] Erro durante setup (não-fatal):', error.message)
        }
      }
    }

    setupPush()

    return () => {
      isMounted = false
      notificationSubscription.remove()
    }
  }, [supabase, session])

  // Cleanup durante logout: executa imediatamente quando session torna-se null,
  // não como cleanup da próxima renderização (que só correria no unmount)
  useEffect(() => {
    if (session) return
    ;(async () => {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
      if (token && supabase) {
        await unregisterNotificationDevice({ supabase, userId: null, token })
        await AsyncStorage.removeItem(PUSH_TOKEN_KEY)
      }
    })()
  }, [session, supabase])
}
