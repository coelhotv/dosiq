// pushToStartRegistration.ts — registro do token push-to-start do Live Activity (spec 041; 091)
//
// Extraído do DoseLiveActivityBridge para ser testável: a spec 091 mudou duas regras daqui.
//   1. Só registra com a conta confirmada pelo SERVIDOR (`getUser`), nunca pelo token local — conta
//      excluída em outro aparelho seguia registrando (INV-3).
//   2. Guarda o token numa chave do aparelho, para o `endSession` desativar a linha
//      `apns_liveactivity` na saída da conta. Sem isso, o servidor seguia podendo INICIAR um Live
//      Activity com a dose de quem saiu (smoke 091, 28/09 — a linha ficou `is_active = true`).

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { syncNotificationDevice } from '@platform/notifications/syncNotificationDevice'
import { LIVE_ACTIVITY_PUSH_TOKEN_KEY } from '@platform/session/localDataWipe'
import { getPushToStartToken } from './liveActivityService'

// Cache do último par (userId,token) registrado com sucesso — evita upsert redundante no Supabase
// a cada foreground/mount quando nada mudou. Escopado por usuário (login diferente re-registra).
let lastRegistered: { userId: string | null; token: string | null } = { userId: null, token: null }

/**
 * Zerado no logout: o `endSession` desativou a linha no servidor, e a MESMA pessoa entrando de novo
 * (mesmo userId+token) cairia no dedupe e ficaria sem push-to-start.
 */
export function resetPushToStartDedupe() {
  lastRegistered = { userId: null, token: null }
}

async function serverConfirmedUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Registra o token push-to-start (iOS 17.2+) no backend p/ a LA iniciar com o app fechado
 * (ADR-076). Best-effort: token vazio (SO ainda não emitiu / iOS < 17.2) → no-op. O RPC usa
 * auth.uid() internamente — o token fica escopado ao dono (041 PO-SEC-2).
 */
export async function registerPushToStart(userId: string | null | undefined): Promise<void> {
  if (!userId) return
  try {
    const token = await getPushToStartToken()
    if (!token) return
    if (userId === lastRegistered.userId && token === lastRegistered.token) return
    if ((await serverConfirmedUserId()) !== userId) return
    await syncNotificationDevice({ supabase, userId, token, provider: 'apns_liveactivity' })
    await AsyncStorage.setItem(LIVE_ACTIVITY_PUSH_TOKEN_KEY, token).catch(() => {})
    lastRegistered = { userId, token }
  } catch (err) {
    if (__DEV__) console.warn('[pushToStartRegistration] registro push-to-start falhou', (err as Error)?.message)
  }
}
