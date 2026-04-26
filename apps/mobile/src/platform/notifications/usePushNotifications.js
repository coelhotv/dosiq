// Hook para setup de push notifications pós-login
// Configura: permissão, token registration, notification handlers
// Cleanup automático em logout (via dependencies)
// N1.4: deeplink real via navigationRef (foreground/background tap + cold start)

import { useEffect } from 'react'
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

// Navega para a tela correta a partir de um tap em push notification
function navigateFromPush(navigation) {
  if (!navigation?.screen) {
    // Fallback obrigatório (spec §10.5): sem screen definida → Today sem params
    navigation = { screen: 'dose-individual', params: {} }
  }
  const { screen, params } = navigation
  const targetRoute = SCREEN_TO_ROUTE[screen] ?? ROUTES.TODAY

  if (navigationRef.current?.isReady()) {
    navigationRef.current.navigate(targetRoute, params)
  } else {
    // Navigator ainda não montado (cold start tardio — raro mas possível)
    const unsubscribe = navigationRef.current?.addListener?.('state', () => {
      navigationRef.current.navigate(targetRoute, params)
      unsubscribe?.()
    })
  }

  if (__DEV__) {
    console.log('[usePushNotifications] Navegando para:', targetRoute, 'params:', params)
  }
}

export function usePushNotifications({ supabase, session }) {
  useEffect(() => {
    if (!session || !supabase) return

    let isMounted = true
    let notificationSubscription

    async function setupPush() {
      try {
        // Cold start: verificar se havia resposta de notificação pendente ao abrir o app
        const lastResponse = await Notifications.getLastNotificationResponseAsync()
        if (lastResponse && isMounted) {
          const navigation = lastResponse.notification.request.content.data?.navigation
          navigateFromPush(navigation)
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
            const navigation = response.notification.request.content.data?.navigation
            navigateFromPush(navigation)
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
