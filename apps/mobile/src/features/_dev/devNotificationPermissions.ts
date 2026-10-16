// devNotificationPermissions.ts — leitura das permissões de notificação para validação em device.
// Nasceu no spike da 054 F1 (T004a); o PO pediu para manter só a leitura (T015b). Nunca pede nada
// ao SO e nunca agenda notificação — só lê.

import { Platform } from 'react-native'
import notifee, { AuthorizationStatus, IOSNotificationSetting } from '@notifee/react-native'
import { getCriticalAlarmDeviceStatus } from '@platform/alarms/alarmService'
import { getPushPermissionStatus, getPushChannelState } from '@platform/notifications/pushPermission'

const AUTH_LABEL: Record<number, string> = {
  [AuthorizationStatus.NOT_DETERMINED]: 'NOT_DETERMINED',
  [AuthorizationStatus.DENIED]: 'DENIED',
  [AuthorizationStatus.AUTHORIZED]: 'AUTHORIZED',
  [AuthorizationStatus.PROVISIONAL]: 'PROVISIONAL',
}

const SETTING_LABEL: Record<number, string> = {
  [IOSNotificationSetting.NOT_SUPPORTED]: 'NOT_SUPPORTED (não perguntado)',
  [IOSNotificationSetting.DISABLED]: 'DISABLED',
  [IOSNotificationSetting.ENABLED]: 'ENABLED',
}

const label = (map: Record<number, string>, v: number | undefined) =>
  v === undefined || v === null ? 'ausente' : (map[v] ?? `desconhecido(${v})`)

const safe = async <T,>(fn: () => Promise<T>): Promise<string> => {
  try {
    return JSON.stringify(await fn())
  } catch (err) {
    return `lançou: ${err instanceof Error ? err.message : String(err)}`
  }
}

/** Snapshot legível das permissões e do estado efetivo do alarme crítico. Nunca lança. */
export async function readNotificationPermissions(): Promise<string> {
  const lines: string[] = []
  try {
    const s = await notifee.getNotificationSettings()
    lines.push(`authorizationStatus: ${label(AUTH_LABEL, s?.authorizationStatus)}`)
    if (Platform.OS === 'ios') {
      lines.push(`ios.alert: ${label(SETTING_LABEL, s?.ios?.alert)}`)
      lines.push(`ios.sound: ${label(SETTING_LABEL, s?.ios?.sound)}`)
      lines.push(`ios.criticalAlert: ${label(SETTING_LABEL, s?.ios?.criticalAlert)}`)
    }
  } catch (err) {
    lines.push(`getNotificationSettings lançou: ${err instanceof Error ? err.message : String(err)}`)
  }
  lines.push(`push efetivo (expo): ${await safe(getPushPermissionStatus)}`)
  if (Platform.OS === 'android') lines.push(`canal push comum: ${await safe(getPushChannelState)}`)
  lines.push(`alarme crítico (faixa): ${await safe(getCriticalAlarmDeviceStatus)}`)
  return lines.join('\n')
}
