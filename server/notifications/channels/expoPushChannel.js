// Canal de notificação Expo Push
// Envia push para todos os devices ativos do usuário (provider = 'expo')
// expoClient é injetado para facilitar testes sem chamadas HTTP reais
// Desativa tokens com erros permanentes via shouldDeactivateDevice (R-042)

import { shouldDeactivateDevice } from '../utils/shouldDeactivateDevice.js'

export async function sendExpoPushNotification({ userId, payload, context, repositories, expoClient }) {
  const correlationId = context?.correlationId || 'unknown'

  const devices = await repositories.devices.listActiveByUser(userId, 'expo')

  if (devices.length === 0) {
    console.info('[expoPushChannel] sem devices ativos', { correlationId, userId })
    return {
      channel: 'mobile_push',
      success: true,
      attempted: 0,
      delivered: 0,
      failed: 0,
      deactivatedTokens: [],
      errors: [],
    }
  }

  const messages = devices.map((device) => ({
    to: device.push_token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.metadata ?? {},
  }))

  let tickets
  try {
    tickets = await expoClient.sendPushNotificationsAsync(messages)
  } catch (error) {
    console.error('[expoPushChannel] falha ao enviar para Expo', { correlationId, userId, error: error.message })
    return {
      channel: 'mobile_push',
      success: false,
      attempted: devices.length,
      delivered: 0,
      failed: devices.length,
      deactivatedTokens: [],
      errors: [{ message: error.message }],
    }
  }

  return normalizeExpoResult({ devices, tickets, repositories, correlationId, userId })
}

async function normalizeExpoResult({ devices, tickets, repositories, correlationId, userId }) {
  let delivered = 0
  let failed = 0
  const errors = []
  const tokensToDeactivate = []

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]
    const device = devices[i]

    if (ticket.status === 'ok') {
      delivered++
    } else {
      failed++
      const errorCode = ticket.details?.error
      errors.push({ token: device.push_token, code: errorCode, message: ticket.message })

      if (errorCode && shouldDeactivateDevice(errorCode)) {
        tokensToDeactivate.push(device.push_token)
      }
    }
  }

  // Desativa tokens inválidos em paralelo (permanent errors apenas)
  const deactivationResults = await Promise.allSettled(
    tokensToDeactivate.map((token) => repositories.devices.deactivateByToken(token))
  )

  const deactivatedTokens = tokensToDeactivate.filter((_, i) => {
    if (deactivationResults[i].status === 'rejected') {
      console.error('[expoPushChannel] falha ao desativar token', { correlationId, userId, token: tokensToDeactivate[i], error: deactivationResults[i].reason?.message })
      return false
    }
    console.info('[expoPushChannel] token desativado', { correlationId, userId, token: tokensToDeactivate[i] })
    return true
  })

  console.info('[expoPushChannel] resultado', { correlationId, userId, attempted: devices.length, delivered, failed, deactivatedTokens })

  return {
    channel: 'mobile_push',
    success: failed === 0,
    attempted: devices.length,
    delivered,
    failed,
    deactivatedTokens,
    errors,
  }
}
