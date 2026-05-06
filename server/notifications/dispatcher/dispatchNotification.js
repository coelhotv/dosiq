// Dispatcher central de notificações multicanal (ADR-029)
import { createLogger } from '../../bot/logger.js'
// Recebe lista de canais resolvidos por resolveChannelsForUser e delega a cada canal
// Falha de um canal não cancela os demais (Promise.allSettled por canal)
// correlationId é obrigatório em todos os logs (R-087)

import { z } from 'zod'
import { buildNotificationPayload, kindSchema } from '../payloads/buildNotificationPayload.js'
import { resolveChannelsForUser } from '../policies/resolveChannelsForUser.js'
import { normalizeChannelResults } from '../utils/normalizeChannelResults.js'
import { 
  getNow, 
  getCurrentTime
} from '../../utils/dateUtils.js'

const logger = createLogger('Dispatcher')

const dispatchInputSchema = z.object({
  userId: z.string().min(1),
  kind: kindSchema,
  channels: z.array(z.string()).default([]),
})

import { 
  dispatchChannel, 
  checkGatePolicy, 
  logNotificationEvent, 
  enqueueToDlq 
} from './_dispatchHelpers.js'

export async function dispatchNotification({ userId, kind, payload, data, channels, context, repositories, bot, expoClient }) {
  const parsed = dispatchInputSchema.safeParse({ userId, kind, channels })
  if (!parsed.success) {
    throw new Error(`[dispatchNotification] Entrada inválida: ${parsed.error.message}`)
  }

  const correlationId = context?.correlationId || `dispatch_${getNow().getTime()}`
  const ctx = { ...context, correlationId }
  
  // Resolve channels if not provided
  let validChannels = parsed.data.channels
  if (validChannels.length === 0) {
    validChannels = await resolveChannelsForUser({ userId, repositories })
  }

  // Se payload não veio, tentamos construir a partir de data usando o builder canônico
  // Isso unifica as chamadas vindas de tasks legadas que ainda usam "data"
  const finalPayload = payload || (typeof buildNotificationPayload === 'function' ? buildNotificationPayload({ kind, data }) : (data || {}))

  // --- Wave N2: Centralized Gate Policy ---
  let isSuppressed = false
  const settings = await repositories.preferences.getSettingsByUserId(userId)
  const currentHHMM = getCurrentTime()

  isSuppressed = checkGatePolicy({ userId, kind, settings, currentHHMM, correlationId })

  if (validChannels.length === 0 && !isSuppressed) {
    console.info('[dispatchNotification] nenhum canal físico ativo — prosseguindo apenas com log (Inbox-First)', { correlationId, userId, kind })
  }

  logger.info('Iniciando dispatch de notificação', { 
    correlationId, 
    userId, 
    kind, 
    channels: validChannels,
    suppressed: isSuppressed 
  })

  let results = []
  if (!isSuppressed && validChannels.length > 0) {
    const settledResults = await Promise.allSettled(
      validChannels.map((channel) => dispatchChannel({ channel, userId, payload: finalPayload, context: ctx, repositories, bot, expoClient }))
    )

    results = settledResults
      .map((r, i) => {
        if (r.status === 'rejected') {
          console.error('[dispatchNotification] canal rejeitou promise', { correlationId, channel: validChannels[i], reason: r.reason?.message })
          return { channel: validChannels[i], success: false, attempted: 0, delivered: 0, failed: 0, deactivatedTokens: [], errors: [{ message: r.reason?.message }] }
        }
        return r.value
      })
      .filter(Boolean)
  }

  const normalized = normalizeChannelResults(results);

  // Sprint 8.4: Um único log por evento (não por canal) — evita duplicatas na inbox
  ;(async () => {
    await logNotificationEvent({
      userId,
      kind,
      finalPayload,
      results,
      validChannels,
      isSuppressed,
      correlationId
    })
  })()

  logger.info('Notificação concluída', {
    correlationId,
    userId,
    kind,
    channels: validChannels,
    totalDelivered: normalized.totalDelivered,
    totalFailed: normalized.totalFailed,
  })

  // --- DLQ Integration (Gate 3.5) ---
  ;(async () => {
    await enqueueToDlq({
      normalized,
      kind,
      data,
      finalPayload,
      userId,
      repositories,
      context,
      results,
      correlationId
    })
  })()

  return normalized
}
