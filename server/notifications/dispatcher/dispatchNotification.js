// Dispatcher central de notificações multicanal (ADR-029)
// Recebe lista de canais resolvidos por resolveChannelsForUser e delega a cada canal
// Falha de um canal não cancela os demais (Promise.allSettled por canal)
// correlationId é obrigatório em todos os logs (R-087)

import { z } from 'zod'
import { sendTelegramNotification } from '../channels/telegramChannel.js'
import { sendExpoPushNotification } from '../channels/expoPushChannel.js'
import { normalizeChannelResults } from '../utils/normalizeChannelResults.js'
import { notificationLogRepository } from '../repositories/notificationLogRepository.js'

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

  const normalized = normalizeChannelResults(results);

  // Sprint 8.4: Um único log por evento (não por canal) — evita duplicatas na inbox
  // Fire-and-forget: não trava o retorno para o cron/request original
  ;(async () => {
    try {
      // Filtra canais sem tentativa e sem erro (ex: nenhum device registrado)
      const activeResults = results.filter(r => r.attempted > 0 || r.errors.length > 0)
      if (activeResults.length === 0) return

      const protocolId = payload.metadata?.protocolId ?? null
      if (!protocolId && kind === 'dose_reminder') {
        console.warn('[dispatchNotification] dose_reminder sem protocolId no metadata', { correlationId, kind })
      }

      // Consolida canais num único array para o log
      const channels = activeResults.map((res) => ({
        channel:    res.channel,
        status:     res.success ? 'enviada' : 'falhou',
        message_id: res.channel === 'telegram' ? (res.messageId ?? null) : null,
        tickets:    res.channel === 'mobile_push' ? (res.tickets ?? null) : null,
      }))

      // Status geral: enviada se ao menos um canal teve sucesso
      const overallStatus = activeResults.some(r => r.success) ? 'enviada' : 'falhou'
      const firstError = activeResults.find(r => !r.success)?.errors?.[0]?.message ?? null

      try {
        await notificationLogRepository.create({
          user_id:           userId,
          protocol_id:       protocolId,
          notification_type: kind,
          title:             payload.title ?? null,
          body:              payload.body ?? null,
          medicine_name:     payload.metadata?.medicineName ?? null,
          protocol_name:     payload.metadata?.protocolName ?? null,
          status:            overallStatus,
          channels,
          telegram_message_id: channels.find(c => c.channel === 'telegram')?.message_id ?? null,
          mensagem_erro:     firstError,
          provider_metadata: {},
        })
      } catch (logErr) {
        console.error('[dispatchNotification] Falha ao persistir log no DB', {
          correlationId,
          userId,
          error: logErr.message,
        })
      }
    } catch (err) {
      console.error('[dispatchNotification] Erro inesperado na rotina de log', {
        correlationId,
        error: err.message,
      })
    }
  })()

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
