// Hook para setup de push notifications pós-login
// Configura: permissão, token registration, notification handlers
// Cleanup automático em logout (via dependencies)
// N1.4: deeplink real via navigationRef (foreground/background tap + cold start)

import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requestPushPermission } from './requestPushPermission'
import { getExpoPushToken } from './getExpoPushToken'
import { syncNotificationDevice } from './syncNotificationDevice'
import { unregisterNotificationDevice } from './unregisterNotificationDevice'
import { navigationRef } from '../../navigation/Navigation'
import { ROUTES } from '../../navigation/routes'

const PUSH_TOKEN_KEY = '@dosiq/expo-push-token'

// Mapa de screen names do payload para rotas do navigator
const SCREEN_TO_ROUTE = {
  'bulk-plan': ROUTES.TODAY,
  'bulk-misc': ROUTES.TODAY,
  'dose-individual': ROUTES.TODAY,
}

// Navega para a tela correta a partir de um tap em push notification.
// createNavigationContainerRef enfileira ações automaticamente — sem listener fallback necessário.
function navigateFromPush(navigationData) {
  const screen = navigationData?.screen
  const params = navigationData?.params ?? {}
  const targetRoute = (screen && SCREEN_TO_ROUTE[screen]) ?? ROUTES.TODAY

  // Incluir screen nos params para que TodayScreen identifique qual modal abrir
  navigationRef.navigate(targetRoute, screen ? { screen, ...params } : params)

  if (__DEV__) {
    console.log('[usePushNotifications] Navegando para:', targetRoute, 'params:', params)
  }
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
        // Cold start: processar resposta pendente apenas uma vez por ciclo de vida do app
        if (!coldStartProcessed.current) {
          coldStartProcessed.current = true
          const lastResponse = await Notifications.getLastNotificationResponseAsync()
          if (lastResponse && isMounted) {
            const navigationData = lastResponse.notification.request.content.data?.navigation
            navigateFromPush(navigationData)
          }
        }

        const { granted } = await requestPushPermission()

        if (!granted) {
          if (__DEV__) console.log('[usePushNotifications] Permissão de push não concedida')
          return
        }

        const token = await getExpoPushToken()
        if (!isMounted) return

        await syncNotificationDevice({
          supabase,
          userId: session.user.id,
          token,
        })

        await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)

        // Configurar handlers (conforme spec Passo 5)
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        })

        // Handler de tap em notificação (foreground / background)
        notificationSubscription = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const navigationData = response.notification.request.content.data?.navigation
            navigateFromPush(navigationData)
          }
        )

        if (__DEV__) {
          console.log('[usePushNotifications] Push setup completo: token =', token.substring(0, 20) + '...')
        }
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
