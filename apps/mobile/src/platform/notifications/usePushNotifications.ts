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
import {
  navigateToDose,
  navigateToHistory,
  navigateToPrivacyData,
  navigateToStock,
  navigateToStockDetail,
  navigateToTreatmentDetail,
  buildSupplyTarget,
} from '@navigation/navigateToDose'
import { createSupplyRunwayRepository } from '@dosiq/core'
import { supabase as nativeSupabaseClient } from '@platform/supabase/nativeSupabaseClient'
import { readStockTrackingCache } from '@platform/storage/stockTrackingCache'
import { resolveSupplyTarget } from './resolveSupplyTarget'
import { ROUTES } from '../../navigation/routes'
import { debugLog } from '@shared/utils/debugLog'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { emitServerReminderOpened } from '@platform/analytics/reminderEvents'
import { isDoseResolved } from '@platform/doseActivity/resolvedDoseStore'

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
  // 090 D-3: destino aninhado sai pelo helper único (espera TABS existir, tiro aninhado a partir do
  // root, allowlist + forma dos params — PO-SEC-3). Antes: `navigate(SCREEN_TO_ROUTE[screen])` do root,
  // que o RootStack não resolvia ("'Hoje' was not handled" no cold start; `history` idem).
  const navigationData = data.navigation
  const screen = navigationData?.screen
  if (screen === 'history') {
    navigateToHistory()
  } else if (screen === 'privacy-data') {
    navigateToPrivacyData()
  } else if (screen === 'stock') {
    // 105 FR-019: `stock_alert`/`stock_expiry_alert`/`prescription_alert` — antes caíam no Hoje (C-12).
    void _navigateToStockTab()
  } else if (screen === 'treatment-detail') {
    void _navigateToSupplyTarget(navigationData?.params)
  } else {
    void _navigateToDoseUnlessResolved(data, screen ? { screen, ...(navigationData?.params ?? {}) } : null)
  }
  debugLog('[usePushNotifications] Navegando para:', screen ?? ROUTES.TODAY)
}

// 105 FR-019: avisos de compra. Payload inválido ⇒ Hoje; o resto decide `resolveSupplyTarget`.
async function _getUserId() {
  const { data, error } = await nativeSupabaseClient.auth.getUser()
  if (error || !data?.user) throw new Error('Sessão expirada')
  return data.user.id
}

let _supplyRepo: ReturnType<typeof createSupplyRunwayRepository> | null = null
function _supplyRepository() {
  // TODO(040-strict): versão do supabase-js do mobile ≠ do core (ver stockService.ts).
  if (!_supplyRepo) _supplyRepo = createSupplyRunwayRepository({ client: nativeSupabaseClient as any, getUserId: _getUserId })
  return _supplyRepo
}

// A aba Estoque só existe com o controle ligado (`RootTabs.tsx`); aviso antigo tocado depois de
// desligar ⇒ Hoje, não rota inexistente. Sem cache ⇒ ligado (degrau 3 do AP-277).
async function _isStockTrackingEnabled() {
  return (await readStockTrackingCache().catch(() => null))?.enabled ?? true
}

async function _navigateToStockTab() {
  if (await _isStockTrackingEnabled()) navigateToStock()
  else navigateToDose(null)
}

async function _navigateToSupplyTarget(rawParams) {
  const target = buildSupplyTarget(rawParams)
  if (!target) {
    navigateToDose(null)
    return
  }
  const repo = _supplyRepository()
  const dest = await resolveSupplyTarget(target, {
    getProtocolOrigin: (id) => repo.getProtocolOrigin(id),
    getSteps: () => repo.getSteps(),
    getMedicineName: (id) => repo.getMedicineName(id),
    isStockTrackingEnabled: _isStockTrackingEnabled,
  })
  if (dest.kind === 'stock') navigateToStockDetail(dest.medicineId, dest.medicineName)
  else if (dest.kind === 'treatment') navigateToTreatmentDetail(dest.protocolId)
  else navigateToDose(null)
}

// 082 D2 (smoke T101 · C-40): push que ficou na bandeja de dose JÁ registrada neste aparelho abre
// o Hoje, não a modal — a modal aceita dose avulsa e convidava a registrar de novo. Só a marca local
// (`resolvedDoseStore`); falha ou push sem `doseInstanceIds` ⇒ comportamento anterior (abre a modal).
async function _navigateToDoseUnlessResolved(data, params) {
  const ids = Array.isArray(data?.doseInstanceIds) ? data.doseInstanceIds.map(String).filter(Boolean) : []
  if (params && ids.length > 0) {
    const flags = await Promise.all(ids.map((id) => isDoseResolved(id).catch(() => false)))
    if (flags.every(Boolean)) {
      navigateToDose(null)
      return
    }
  }
  navigateToDose(params)
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
