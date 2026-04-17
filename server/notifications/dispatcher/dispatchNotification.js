// Dispatcher central de notificações multicanal (ADR-029)
// Recebe lista de canais resolvidos por resolveChannelsForUser e delega a cada canal
// Falha de um canal não cancela os demais (Promise.allSettled por canal)
// correlationId é obrigatório em todos os logs (R-087)

import { z } from 'zod'
import { sendTelegramNotification } from '../channels/telegramChannel.js'
import { sendExpoPushNotification } from '../channels/expoPushChannel.js'
import { normalizeChannelResults } from '../utils/normalizeChannelResults.js'

const dispatchInputSchema = z.object({
  userId: z.string().min(1),
  kind: z.enum(['dose_reminder', 'stock_alert', 'daily_digest']),
  channels: z.array(z.string()).default([]),
})

async function dispatchChannel({ channel, userId, payload, context, repositories, bot, expoClient }) {
  const correlationId = context.correlationId
  try {
    if (channel === 'telegram') {
      return await sendTelegramNotification({ userId, payload, context, bot })
    } else if (channel === 'mobile_push') {
      return await sendExpoPushNotification({ userId, payload, context, repositories, expoClient })
    } else {
      console.warn('[dispatchNotification] canal desconhecido ignorado', { correlationId, channel })
      return null
    }
  } catch (error) {
    console.error('[dispatchNotification] canal falhou', { correlationId, userId, channel, error: error.message })
    return {
      channel,
      success: false,
      attempted: 0,
      delivered: 0,
      failed: 0,
      deactivatedTokens: [],
      errors: [{ message: error.message }],
    }
  }
}

export async function dispatchNotification({ userId, kind, payload, channels, context, repositories, bot, expoClient }) {
  const parsed = dispatchInputSchema.safeParse({ userId, kind, channels })
  if (!parsed.success) {
    throw new Error(`[dispatchNotification] Entrada inválida: ${parsed.error.message}`)
  }

  const correlationId = context?.correlationId || `dispatch_${Date.now()}`
  const ctx = { ...context, correlationId }
  const validChannels = parsed.data.channels

  if (validChannels.length === 0) {
    console.info('[dispatchNotification] nenhum canal — skipping', { correlationId, userId, kind })
    return normalizeChannelResults([])
  }

  console.info('[dispatchNotification] iniciando', { correlationId, userId, kind, channels: validChannels })

  const settledResults = await Promise.allSettled(
    validChannels.map((channel) => dispatchChannel({ channel, userId, payload, context: ctx, repositories, bot, expoClient }))
  )

  const results = settledResults
    .map((r, i) => {
      if (r.status === 'rejected') {
        console.error('[dispatchNotification] canal rejeitou promise', { correlationId, channel: validChannels[i], reason: r.reason?.message })
        return { channel: validChannels[i], success: false, attempted: 0, delivered: 0, failed: 0, deactivatedTokens: [], errors: [{ message: r.reason?.message }] }
      }
      return r.value
    })
    .filter(Boolean)

  const normalized = normalizeChannelResults(results)

  console.info('[dispatchNotification] concluído', {
    correlationId,
    userId,
    kind,
    channels: validChannels,
    totalDelivered: normalized.totalDelivered,
    totalFailed: normalized.totalFailed,
  })

  return normalized
}
