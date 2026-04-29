// Política de resolução de canais de notificação (Wave N2+)
// Flags explícitas têm precedência sobre notification_preference legado

// Retorna array de canais válidos: [], ['telegram'], ['mobile_push'], ['web_push'], ou combinações

export async function resolveChannelsForUser({ userId, repositories }) {
  const hasTelegram       = await repositories.preferences.hasTelegramChat(userId)
  const activeExpoDevices = await repositories.devices.listActiveByUser(userId, 'expo')
  const activeWebDevices  = await repositories.devices.listActiveByUser(userId, 'webpush')

  // Tentar buscar settings completos (flags de canal Wave N2)
  const settings = repositories.preferences.getSettingsByUserId 
    ? await repositories.preferences.getSettingsByUserId(userId)
    : null

  // 1. Modo explícito Wave N2: usar flags booleanas de canal (precedência)
  if (
    settings &&
    settings.channel_mobile_push_enabled !== undefined &&
    settings.channel_telegram_enabled !== undefined
  ) {
    const channels = []
    if (settings.channel_mobile_push_enabled && activeExpoDevices.length > 0) channels.push('mobile_push')
    if (settings.channel_web_push_enabled    && activeWebDevices.length > 0)  channels.push('web_push')
    if (settings.channel_telegram_enabled    && hasTelegram)                   channels.push('telegram')
    return channels
  }

  // 2. Fallback legado: notification_preference (string enum)
  const preference = await repositories.preferences.getByUserId(userId)
  if (preference === 'none') return []
  if (preference === 'telegram')    return hasTelegram ? ['telegram'] : []
  if (preference === 'mobile_push') return activeExpoDevices.length > 0 ? ['mobile_push'] : []
  if (preference === 'both') {
    return [
      ...(hasTelegram ? ['telegram'] : []),
      ...(activeExpoDevices.length > 0 ? ['mobile_push'] : []),
    ]
  }

  // 3. Sistema: ID de sistema sempre resolve para telegram (admin)
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
  if (userId === SYSTEM_USER_ID) return ['telegram']

  return []
}
