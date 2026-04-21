// Hook para setup de push notifications pós-login
// Configura: permissão, token registration, notification handlers
// Cleanup automático em logout (via dependencies)

import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requestPushPermission } from './requestPushPermission'
import { getExpoPushToken } from './getExpoPushToken'
import { syncNotificationDevice } from './syncNotificationDevice'
import { unregisterNotificationDevice } from './unregisterNotificationDevice'

const PUSH_TOKEN_KEY = '@dosiq/expo-push-token'

export function usePushNotifications({ supabase, session }) {
  useEffect(() => {
    if (!session || !supabase) return

    let isMounted = true
    let notificationSubscription

    async function setupPush() {
      try {
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
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        })

        // Handler de tap em notificação (background/cold start)
        notificationSubscription = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const navigation = response.notification.request.content.data?.navigation
            if (navigation?.screen) {
              // Navegar para tela especificada (seria via event emitter ou context)
              if (__DEV__) {
                console.log('[usePushNotifications] Notificação tap:', navigation.screen)
              }
            } else {
              // Fallback obrigatório (spec §10.5)
              if (__DEV__) {
                console.log('[usePushNotifications] Navegar para Today (fallback)')
              }
            }
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
