// Permissão de push — modelo CONTEXTUAL (não pedir no 1º load).
//
// Princípio (persona dona Maria, non-tech): o prompt do OS é "bala única". Pedir
// sem contexto → usuário nega por reflexo → push morre (reativar exige ir nas
// Configurações do SO, que ela não faz). Então só pedimos em momentos de INTENÇÃO
// clara: toggle de lembrete no onboarding, criação manual do 1º tratamento, ou ao
// ligar notificações nas Configurações.
//
// - getPushPermissionStatus(): leitura PURA do status, NUNCA dispara prompt.
// - ensurePushPermission(): pede só se ainda dá (undetermined). Se negado e sem
//   poder repedir, retorna { blocked:true } para o caller oferecer deep link p/
//   as Configurações do SO.
// - enablePushAtIntent(): ensure + registra o token se concedido (one-call dos
//   pontos de intenção).

import * as Notifications from 'expo-notifications'
import { Linking, Platform } from 'react-native'
import { registerPushToken } from './registerPushToken'
import { debugLog } from '@shared/utils/debugLog'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { ANDROID_PUSH_CHANNEL } from '@dosiq/core'

// 054 C-23: no iOS, Alertas Críticos permitidos deixam o app "autorizado" mesmo com alerta/som/banner
// DESLIGADOS — o `granted` do expo é só `authorizationStatus == Authorized`
// (EXUserFacingNotificationsPermissionsRequester.m:38). Push "ligado" exige o alerta habilitado.
// `allowsAlert: null` (não informado) não rebaixa. Já decidido ⇒ não dá para repedir (só Ajustes).
function _effective(perm: Notifications.NotificationPermissionsStatus | null | undefined) {
  const alertOff = Platform.OS === 'ios' && perm?.ios?.allowsAlert === false
  if (perm?.status === 'granted' && alertOff) return { status: 'denied', canAskAgain: false, granted: false }
  return { status: perm?.status, canAskAgain: perm?.canAskAgain, granted: perm?.status === 'granted' }
}

// Status puro — sem efeitos colaterais. 'granted' | 'undetermined' | 'denied'.
export async function getPushPermissionStatus() {
  return _effective(await Notifications.getPermissionsAsync())
}

// 054 C-31: no Android a permissão geral pode estar concedida com o CANAL do push comum desligado
// (Ajustes › Apps › dosiq › Notificações) — o SO descarta tudo que chega nele e o "Celular" mentia.
// 'blocked' = importância NONE · 'silenced' = MIN/LOW (chega sem som) · 'unknown' = canal ausente
// ou leitura falhou (não afirmar nada) · iOS não tem canais ⇒ sempre 'ok'.
export async function getPushChannelState(): Promise<'ok' | 'blocked' | 'silenced' | 'unknown'> {
  if (Platform.OS !== 'android') return 'ok'
  try {
    const channel = await Notifications.getNotificationChannelAsync(ANDROID_PUSH_CHANNEL.DEFAULT)
    if (!channel) return 'unknown'
    const { NONE, MIN, LOW } = Notifications.AndroidImportance
    if (channel.importance === NONE) return 'blocked'
    if (channel.importance === MIN || channel.importance === LOW) return 'silenced'
    return 'ok'
  } catch {
    return 'unknown'
  }
}

// Pede permissão apenas em ponto de intenção. Nunca repete prompt já negado.
// Retorna { granted, blocked }: blocked=true quando negado e não dá p/ repedir
// (caller deve oferecer abrir Configurações do SO).
export async function ensurePushPermission() {
  const { status, canAskAgain } = _effective(await Notifications.getPermissionsAsync())
  if (status === 'granted') return { granted: true, blocked: false }
  if (canAskAgain) {
    const res = _effective(await Notifications.requestPermissionsAsync())
    const granted = res.granted
    // 065 US5: só aqui o prompt do SO de fato apareceu — é a DECISÃO da pessoa. Já concedido ou
    // negado sem poder repedir não é decisão nova e não emite. O prompt só existe com o app aberto.
    await logEvent(
      granted ? EVENTS.NOTIFICATION_PERMISSION_GRANTED : EVENTS.NOTIFICATION_PERMISSION_DENIED,
      { surface: SURFACES.MOBILE }
    )
    return { granted, blocked: !granted && res.canAskAgain === false }
  }
  // negado + não pode repedir → só via Configurações do SO
  return { granted: false, blocked: true }
}

// 054 C-33: no Android o `canAskAgain` do expo não distingue "nunca perguntado" de "negado de vez"
// depois de um diálogo dispensado (cache `didAsk` do expo + `shouldShowRequestPermissionRationale`
// falso). Medido no smoke (0.33.36): POST_NOTIFICATIONS sem USER_SET/USER_FIXED e mesmo assim
// `canAskAgain:false` ⇒ o app mandava aos Ajustes algo que 1 "Permitir" resolvia. Então no Android
// a gente SEMPRE pede: o SO mostra o diálogo se ainda pode; se não pode, devolve negado na hora,
// sem diálogo — e só aí (resposta instantânea) cabe abrir os Ajustes.
const INSTANT_DENIAL_MS = 400

export async function requestPushOrOpenSettings({ supabase }: { supabase: unknown }): Promise<boolean> {
  if (Platform.OS !== 'android') {
    const res = await enablePushAtIntent({ supabase })
    if (!res.granted && res.blocked) Linking.openSettings()
    return res.granted
  }
  const startedAt = Date.now()
  const res = _effective(await Notifications.requestPermissionsAsync())
  if (res.granted) {
    await logEvent(EVENTS.NOTIFICATION_PERMISSION_GRANTED, { surface: SURFACES.MOBILE })
    try {
      await registerPushToken({ supabase })
    } catch (err) {
      debugLog('pushPermission', 'registerPushToken falhou', err?.message)
    }
    return true
  }
  if (Date.now() - startedAt < INSTANT_DENIAL_MS) {
    // Sem diálogo: o Android já não pergunta ⇒ Ajustes.
    Linking.openSettings()
  } else {
    await logEvent(EVENTS.NOTIFICATION_PERMISSION_DENIED, { surface: SURFACES.MOBILE })
  }
  return false
}

// One-call para pontos de intenção: pede (se cabível) e, se concedido, registra
// o token imediatamente (para os lembretes funcionarem já, sem esperar relaunch).
export async function enablePushAtIntent({ supabase }) {
  const { granted, blocked } = await ensurePushPermission()
  if (granted) {
    try {
      await registerPushToken({ supabase })
    } catch (err) {
      debugLog('pushPermission', 'registerPushToken falhou', err?.message)
    }
  }
  return { granted, blocked }
}
