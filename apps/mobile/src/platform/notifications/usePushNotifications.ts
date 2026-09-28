// Hook para setup de push notifications pós-login — REGISTER-ONLY.
// NUNCA pede permissão aqui (isso é dos pontos de intenção — ver pushPermission.js).
// Se a permissão já foi concedida, registra o token; senão, não faz nada.
// Configura handlers + tap listener (deeplink real via navigationRef).
// Cleanup automático em logout (via dependencies).

import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { getPushPermissionStatus } from './pushPermission'
import { registerPushToken } from './registerPushToken'
import { ensurePushChannel } from './ensurePushChannel'
import { ensureTitrationCategories, handleTitrationNotificationAction, isTitrationAction } from './titrationNotificationActions'
import { navigationRef } from '../../navigation/navigationRef'
import { ROUTES } from '../../navigation/routes'
import { debugLog } from '@shared/utils/debugLog'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { emitServerReminderOpened } from '@platform/analytics/reminderEvents'

// Mapa de screen names do payload para rotas do navigator
const SCREEN_TO_ROUTE = {
  'bulk-plan': ROUTES.TODAY,
  'bulk-misc': ROUTES.TODAY,
  'dose-individual': ROUTES.TODAY,
  'history': ROUTES.DOSE_HISTORY,
  // 046 Slice C — aviso de exclusão por consentimento revogado. Só passa a valer em build novo;
  // nos binários já publicados o tap segue caindo em TODAY (o mesmo de antes, não uma regressão).
  'privacy-data': ROUTES.PRIVACY_DATA,
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
  // 🔴 065 C1 (provado no emulador Android, 26/09, logcat): o toque numa notificação do NOTIFEE
  // chega ao listener do expo com o ENVELOPE do Notifee como `data`
  // (`notifee_event_type, pressAction, notification, notification_id`) — o `doseInstanceId` fica
  // aninhado em `data.notification.data`, fora do alcance da guarda acima (AP-207). O app navegava
  // para o Hoje em paralelo e o toque contava como push. Critério POSITIVO: push do nosso servidor
  // sempre traz `navigation` e `kind` (buildNotificationPayload → expoPushChannel). Sem eles, não
  // é push remoto: não navega nem mede (o handler do Notifee cuida do toque).
  if (data.navigation == null && typeof data.kind !== 'string') return
  // 065 US5: gargalo ÚNICO do toque no corpo do push (listener + cold start passam aqui; ação de
  // titulação e alarme nativo saem antes). `kind` é o do servidor, verbatim — enum fechado, zero PII.
  logEvent(EVENTS.PUSH_NOTIFICATION_TAPPED, {
    surface: SURFACES.PUSH,
    ...(typeof data.kind === 'string' ? { kind: data.kind } : {}),
  })
  // 065 AD-8: push de LEMBRETE de dose também conta como "o lembrete abriu o app" (qualquer canal).
  emitServerReminderOpened(data)
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

export function usePushNotifications({ supabase, session, canRegister = false }) {
  // Flag para garantir que o cold start seja processado apenas uma vez por ciclo de vida do app,
  // mesmo que o useEffect re-execute em logout+login sem fechar o app.
  const coldStartProcessed = useRef(false)
  // Spec 091: o efeito depende do ID da pessoa, não do objeto `session`. A identidade do objeto muda
  // a cada renovação de token e a cada re-login — inclusive o da conferência de senha da exclusão de
  // conta, que re-registrava o aparelho 0,2s DEPOIS do RPC de exclusão (smoke 28/09, iOS).
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId || !supabase) return

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
        // Spec 091 (INV-3): registrar o aparelho é escrita em nome da pessoa — só com a conta
        // confirmada no servidor (conta excluída batia na FK de notification_devices).
        if (!canRegister) return
        await registerPushToken({ supabase, userId })
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
  }, [supabase, userId, canRegister])
}
