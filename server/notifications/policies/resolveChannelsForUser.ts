// Política de resolução de canais de notificação (Wave N2+)
// Flags explícitas têm precedência sobre notification_preference legado

// Retorna array de canais válidos: [], ['telegram'], ['mobile_push'], ['web_push'], ou combinações

import type { NotificationDevice } from '../repositories/notificationDeviceRepository.js'
import type { NotificationPreference, NotificationSettings } from '../repositories/notificationPreferenceRepository.js'

type Channel = 'telegram' | 'mobile_push' | 'web_push'

export interface ResolveChannelsRepositories {
  preferences: {
    hasTelegramChat(userId: string): Promise<boolean>
    getSettingsByUserId?(userId: string): Promise<NotificationSettings>
    getByUserId(userId: string): Promise<NotificationPreference>
  }
  devices: {
    listActiveByUser(userId: string, provider?: string): Promise<NotificationDevice[]>
  }
}

function resolveWaveN2(
  settings: NotificationSettings,
  activeExpoDevices: NotificationDevice[],
  activeWebDevices: NotificationDevice[],
  hasTelegram: boolean
): Channel[] {
  const channels: Channel[] = []
  if (settings.channel_mobile_push_enabled && activeExpoDevices.length > 0) channels.push('mobile_push')
  if (settings.channel_web_push_enabled    && activeWebDevices.length > 0)  channels.push('web_push')
  if (settings.channel_telegram_enabled    && hasTelegram)                   channels.push('telegram')
  return channels
}

function resolveLegacy(
  preference: NotificationPreference,
  hasTelegram: boolean,
  activeExpoDevices: NotificationDevice[]
): Channel[] {
  if (preference === 'none') return []
  if (preference === 'telegram') return hasTelegram ? ['telegram'] : []
  if (preference === 'mobile_push') return activeExpoDevices.length > 0 ? ['mobile_push'] : []
  if (preference === 'both') {
    return [
      ...(hasTelegram ? (['telegram'] as Channel[]) : []),
      ...(activeExpoDevices.length > 0 ? (['mobile_push'] as Channel[]) : []),
    ]
  }
  return []
}

export interface ResolveChannelsForUserParams {
  userId: string
  repositories: ResolveChannelsRepositories
  isCritical?: boolean
}

export async function resolveChannelsForUser({ userId, repositories, isCritical = false }: ResolveChannelsForUserParams): Promise<Channel[]> {
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
  if (userId === SYSTEM_USER_ID) return ['telegram']

  const hasTelegram       = await repositories.preferences.hasTelegramChat(userId)
  const activeExpoDevices = await repositories.devices.listActiveByUser(userId, 'expo')
  const activeWebDevices  = await repositories.devices.listActiveByUser(userId, 'webpush')

  const settings = repositories.preferences.getSettingsByUserId 
    ? await repositories.preferences.getSettingsByUserId(userId)
    : null

  let channels: Channel[] = []
  if (settings?.channel_mobile_push_enabled !== undefined && settings?.channel_telegram_enabled !== undefined) {
    channels = resolveWaveN2(settings, activeExpoDevices, activeWebDevices, hasTelegram)
  } else {
    const preference = await repositories.preferences.getByUserId(userId)
    channels = resolveLegacy(preference, hasTelegram, activeExpoDevices)
  }

  // Dose essencial/crítica = extensão do alarme timeSensitive: deve ir SÓ pelo canal de alarme
  // (mobile_push), NUNCA junto do telegram/web_push (que duplicam o aviso e imprimem o body com
  // horário). Se o usuário tem device mobile ativo → restringe a mobile_push (fura preferências p/
  // garantir o alarme). Se NÃO tem device → cai pra telegram como fallback (nunca fica mudo).
  if (isCritical) {
    if (activeExpoDevices.length > 0) return ['mobile_push']
    if (hasTelegram) return ['telegram']
    return []
  }

  return channels
}
