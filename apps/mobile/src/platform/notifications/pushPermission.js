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
import { registerPushToken } from './registerPushToken'
import { debugLog } from '@shared/utils/debugLog'

// Status puro — sem efeitos colaterais. 'granted' | 'undetermined' | 'denied'.
export async function getPushPermissionStatus() {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync()
  return { status, canAskAgain, granted: status === 'granted' }
}

// Pede permissão apenas em ponto de intenção. Nunca repete prompt já negado.
// Retorna { granted, blocked }: blocked=true quando negado e não dá p/ repedir
// (caller deve oferecer abrir Configurações do SO).
export async function ensurePushPermission() {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync()
  if (status === 'granted') return { granted: true, blocked: false }
  if (canAskAgain) {
    const res = await Notifications.requestPermissionsAsync()
    const granted = res.status === 'granted'
    return { granted, blocked: !granted && res.canAskAgain === false }
  }
  // negado + não pode repedir → só via Configurações do SO
  return { granted: false, blocked: true }
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
