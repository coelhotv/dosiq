// Política de resolução de canais de notificação (Wave N2+)
// Flags explícitas têm precedência sobre notification_preference legado

// Retorna array de canais válidos: [], ['telegram'], ['mobile_push'], ['web_push'], ou combinações

function resolveWaveN2(settings, activeExpoDevices, activeWebDevices, hasTelegram) {
  const channels = []
  if (settings.channel_mobile_push_enabled && activeExpoDevices.length > 0) channels.push('mobile_push')
  if (settings.channel_web_push_enabled    && activeWebDevices.length > 0)  channels.push('web_push')
  if (settings.channel_telegram_enabled    && hasTelegram)                   channels.push('telegram')
  return channels
}

function resolveLegacy(preference, hasTelegram, activeExpoDevices) {
  if (preference === 'none') return []
  if (preference === 'telegram') return hasTelegram ? ['telegram'] : []
  if (preference === 'mobile_push') return activeExpoDevices.length > 0 ? ['mobile_push'] : []
  if (preference === 'both') {
    return [
      ...(hasTelegram ? ['telegram'] : []),
      ...(activeExpoDevices.length > 0 ? ['mobile_push'] : []),
    ]
  }
  return []
}

export async function resolveChannelsForUser({ userId, repositories }) {
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
  if (userId === SYSTEM_USER_ID) return ['telegram']

  const hasTelegram       = await repositories.preferences.hasTelegramChat(userId)
  const activeExpoDevices = await repositories.devices.listActiveByUser(userId, 'expo')
  const activeWebDevices  = await repositories.devices.listActiveByUser(userId, 'webpush')

  const settings = repositories.preferences.getSettingsByUserId 
    ? await repositories.preferences.getSettingsByUserId(userId)
    : null

  if (settings?.channel_mobile_push_enabled !== undefined && settings?.channel_telegram_enabled !== undefined) {
    return resolveWaveN2(settings, activeExpoDevices, activeWebDevices, hasTelegram)
  }

  const preference = await repositories.preferences.getByUserId(userId)
  return resolveLegacy(preference, hasTelegram, activeExpoDevices)
}
