// Política de resolução de canais de notificação (Wave N2+)
// Flags explícitas têm precedência sobre notification_preference legado

// Retorna array de canais válidos: [], ['telegram'], ['mobile_push'], ['web_push'], ou combinações

export async function resolveChannelsForUser({ userId, repositories }) {
  const hasTelegram       = await repositories.preferences.hasTelegramChat(userId)
  const activeExpoDevices = await repositories.devices.listActiveByUser(userId, 'expo')
  const activeWebDevices  = await repositories.devices.listActiveByUser(userId, 'webpush')

  // Tentar buscar settings completos (com flags Wave N2)
  let settings = null
  if (repositories.preferences.getSettingsByUserId) {
    settings = await repositories.preferences.getSettingsByUserId(userId)
  }

  // Modo explícito Wave N2: usar flags de canal se presentes
  if (
    settings &&
    settings.channel_mobile_push_enabled !== undefined &&
    settings.channel_web_push_enabled !== undefined &&
    settings.channel_telegram_enabled !== undefined
  ) {
    const channels = []
    if (settings.channel_mobile_push_enabled && activeExpoDevices.length > 0) channels.push('mobile_push')
    if (settings.channel_web_push_enabled    && activeWebDevices.length > 0)  channels.push('web_push')
    if (settings.channel_telegram_enabled    && hasTelegram)                   channels.push('telegram')
    return channels
  }

  // Fallback legado: notification_preference
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
  return []
}
