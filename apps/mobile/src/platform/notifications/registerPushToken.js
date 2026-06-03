// Registra o Expo push token no backend — assume permissão JÁ concedida (não
// pede). Usado pelo setup global (register-only) e pelos pontos de intenção
// (após enablePushAtIntent conceder). Idempotente.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getExpoPushToken } from './getExpoPushToken'
import { syncNotificationDevice } from './syncNotificationDevice'
import { isAlarmEnabled } from '@platform/alarms/alarmEnabledStore'
import { debugLog } from '@shared/utils/debugLog'

export const PUSH_TOKEN_KEY = '@dosiq/expo-push-token'

// Resolve userId pela sessão atual quando não passado. Retorna o token ou null.
// nativeAlarmEnabled propaga o flag do alarme nativo pro device (gate de duplicata,
// Spec 001 A2); se não passado, lê o estado atual do toggle (default OFF).
export async function registerPushToken({ supabase, userId, nativeAlarmEnabled }) {
  const token = await getExpoPushToken()
  if (!token) return null

  let uid = userId
  if (!uid) {
    const { data } = await supabase.auth.getUser()
    uid = data?.user?.id
  }
  if (!uid) {
    debugLog('registerPushToken', 'sem userId — abortado')
    return null
  }

  const alarmFlag = nativeAlarmEnabled ?? (await isAlarmEnabled())
  await syncNotificationDevice({ supabase, userId: uid, token, nativeAlarmEnabled: alarmFlag })
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
  debugLog('registerPushToken', 'token registrado', token.substring(0, 20) + '...')
  return token
}
