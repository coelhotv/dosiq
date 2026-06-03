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
import { navigationRef } from '../../navigation/navigationRef'
import { ROUTES } from '../../navigation/routes'
import { debugLog } from '@shared/utils/debugLog'

// Mapa de screen names do payload para rotas do navigator
const SCREEN_TO_ROUTE = {
  'bulk-plan': ROUTES.TODAY,
  'bulk-misc': ROUTES.TODAY,
  'dose-individual': ROUTES.TODAY,
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
    let notificationSubscription

    async function setupPush() {
      try {
        // Canal Android com o som próprio do app (push_chime). No-op no iOS.
        await ensurePushChannel()

        // Cold start: processar resposta pendente apenas uma vez por ciclo de vida do app
        if (!coldStartProcessed.current) {
          coldStartProcessed.current = true
          const lastResponse = await Notifications.getLastNotificationResponseAsync()
          if (lastResponse && isMounted) {
            navigateFromPush(lastResponse.notification.request.content.data)
          }
        }

        // Handlers + tap listener SEMPRE (independem de permissão; harmless se não
        // houver notificações). Garantem que um tap roteie certo assim que houver.
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        })
        notificationSubscription = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            navigateFromPush(response.notification.request.content.data)
          }
        )

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
          console.error('[usePushNotifications] Erro durante setup:', error.message)
        }
      }
    }

    setupPush()

    return () => {
      isMounted = false
      notificationSubscription?.remove()
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
