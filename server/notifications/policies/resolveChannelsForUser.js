// Política de resolução de canais de notificação
// Determina quais canais usar para notificar um usuário baseado em:
// 1. Preferência de notificação (notification_preference em user_settings)
// 2. Disponibilidade de cada canal (telegram_chat_id ou dispositivos ativos)

// Retorna array de canais válidos: [], ['telegram'], ['mobile_push'], ou ['telegram', 'mobile_push']

export async function resolveChannelsForUser({ userId, repositories }) {
  const preference = await repositories.preferences.getByUserId(userId)
  const hasTelegram = await repositories.preferences.hasTelegramChat(userId)
  const activeExpoDevices = await repositories.devices.listActiveByUser(userId, 'expo')

  // Caso 1: Usuário prefere não receber notificações
  if (preference === 'none') return []

  // Caso 2: Telegram apenas (se disponível)
  if (preference === 'telegram') {
    return hasTelegram ? ['telegram'] : []
  }

  // Caso 3: Mobile push apenas (se tiver dispositivos ativos)
  if (preference === 'mobile_push') {
    return activeExpoDevices.length > 0 ? ['mobile_push'] : []
  }

  // Caso 4: Ambos os canais (qualquer um que esteja disponível)
  if (preference === 'both') {
    return [
      ...(hasTelegram ? ['telegram'] : []),
      ...(activeExpoDevices.length > 0 ? ['mobile_push'] : []),
    ]
  }

  // Fallback (não deveria chegar aqui se CHECK constraint funcionar)
  return []
}
