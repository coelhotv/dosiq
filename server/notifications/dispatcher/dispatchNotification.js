// Dispatcher central de notificações multicanal (ADR-029)
import { createLogger } from '../../bot/logger.js'
// Recebe lista de canais resolvidos por resolveChannelsForUser e delega a cada canal
// Falha de um canal não cancela os demais (Promise.allSettled por canal)
// correlationId é obrigatório em todos os logs (R-087)

import { z } from 'zod'
import { buildNotificationPayload, kindSchema } from '../payloads/buildNotificationPayload.js'
import { resolveChannelsForUser } from '../policies/resolveChannelsForUser.js'
import { sendTelegramNotification } from '../channels/telegramChannel.js'
import { sendExpoPushNotification } from '../channels/expoPushChannel.js'
import { shouldSendNow } from '../utils/notificationGate.js'
import { normalizeChannelResults } from '../utils/normalizeChannelResults.js'
import { notificationLogRepository } from '../repositories/notificationLogRepository.js'
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

async function dispatchChannel({ channel, userId, payload, context, repositories, bot, expoClient }) {
  const correlationId = context.correlationId
  try {
    if (channel === 'telegram') {
      return await sendTelegramNotification({ userId, payload, context, bot })
    } else if (channel === 'mobile_push') {
      return await sendExpoPushNotification({ userId, payload, context, repositories, expoClient })
    } else {
      logger.warn('canal desconhecido ignorado', { correlationId, channel })
      return null
    }
  } catch (error) {
    logger.error('canal falhou', error, { correlationId, userId, channel })
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
  // Relatórios e digests não são "alertas" e ignoram quiet_hours e modo digest (só param no silent)
  const isAlert = !['daily_digest', 'weekly_adherence', 'monthly_report', 'adherence_report'].includes(kind)

  if (isAlert) {
    const settings = await repositories.preferences.getSettingsByUserId(userId)
    const currentHHMM = getCurrentTime()

    const isQuietEnabled = settings.quiet_hours_enabled ?? false
    
    const shouldSend = shouldSendNow({
      mode: settings.notification_mode || 'realtime',
      quietHoursStart: isQuietEnabled ? settings.quiet_hours_start : null,
      quietHoursEnd: isQuietEnabled ? settings.quiet_hours_end : null,
      currentHHMM
    })

    if (!shouldSend) {
      isSuppressed = true
      console.info('[dispatchNotification] suprimida pelo gate', { 
        correlationId, 
        userId, 
        kind, 
        mode: settings.notification_mode,
        quietHours: isQuietEnabled ? `${settings.quiet_hours_start}-${settings.quiet_hours_end}` : 'disabled'
      })
    }
  }

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
    try {
      // Wave 12: Sempre logar se houver payload, mesmo sem canais físicos, para alimentar a Inbox
      if (!finalPayload) return;

      const isGroupedKind = kind === 'dose_reminder_by_plan' || kind === 'dose_reminder_misc'
      const protocolId = isGroupedKind ? null : (finalPayload?.metadata?.protocolId ?? null)
      
      const activeResults = results.filter(r => r.attempted > 0 || r.errors.length > 0)

      const logChannels = activeResults.map((res) => ({
        channel:    res.channel,
        status:     res.success ? 'enviada' : 'falhou',
        message_id: res.channel === 'telegram' ? (res.messageId ?? null) : null,
        tickets:    res.channel === 'mobile_push' ? (res.tickets ?? null) : null,
      }))

      let overallStatus = 'falhou'
      if (isSuppressed) {
        overallStatus = 'silenciada'
      } else if (activeResults.some(r => r.success) || (validChannels.length === 0 && !isSuppressed)) {
        overallStatus = 'enviada'
      }

      const firstError = activeResults.find(r => !r.success)?.errors?.[0]?.message ?? null

      try {
        await notificationLogRepository.create({
          user_id:              userId,
          protocol_id:          protocolId,
          notification_type:    kind,
          title:                finalPayload.title ?? null,
          body:                 finalPayload.body ?? null,
          medicine_name:        finalPayload.metadata?.medicineName ?? null,
          protocol_name:        finalPayload.metadata?.protocolName ?? null,
          treatment_plan_id:    finalPayload.metadata?.planId ?? null,
          treatment_plan_name:  finalPayload.metadata?.planName ?? null,
          status:               overallStatus,
          channels:             logChannels,
          telegram_message_id:  logChannels.find(c => c.channel === 'telegram')?.message_id ?? null,
          mensagem_erro:        firstError,
          provider_metadata: {
            ...(finalPayload.metadata?.protocolIds ? { protocol_ids: finalPayload.metadata.protocolIds } : {}),
            ...(finalPayload.metadata?.planId ? { treatment_plan_id: finalPayload.metadata.planId } : {}),
            ...(finalPayload.metadata?.percentage !== undefined ? { percentage: finalPayload.metadata.percentage } : {}),
            ...(finalPayload.metadata?.expected_doses !== undefined ? { expected_doses: finalPayload.metadata.expected_doses } : {}),
            ...(finalPayload.metadata?.taken_doses !== undefined ? { taken_doses: finalPayload.metadata.taken_doses } : {}),
            ...(finalPayload.metadata?.nudge ? { nudge: finalPayload.metadata.nudge } : {}),
            ...(finalPayload.metadata?.storytelling ? { storytelling: finalPayload.metadata.storytelling } : {}),
            ...(finalPayload.metadata?.details ? { details: finalPayload.metadata.details } : {}),
          },
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


  logger.info('Notificação concluída', {
    correlationId,
    userId,
    kind,
    channels: validChannels,
    totalDelivered: normalized.totalDelivered,
    totalFailed: normalized.totalFailed,
  })

  // --- DLQ Integration (Gate 3.5) ---
  // Se houver falhas e o repositório estiver presente, enfileiramos para o Admin (DLQ)
  // Evitamos re-enfileirar retentativas manuais (que já estão na DLQ e são tratadas pelo handler de retry)
  if (normalized.totalFailed > 0 && repositories?.dlq && !context?.isRetry) {
    const firstError = results.find(r => !r.success)?.errors?.[0];
    const isGroupedKind = kind === 'dose_reminder_by_plan' || kind === 'dose_reminder_misc';
    const protocolId = isGroupedKind ? null : (finalPayload?.metadata?.protocolId ?? null);

    // Enfileira de forma assíncrona (não bloqueia o retorno do dispatch)
    ;(async () => {
      try {
        await repositories.dlq.enqueue({
          userId,
          protocolId,
          type: kind,
          ...(data || {}) // L1 payload original para futura retentativa
        }, firstError, 1, correlationId);
        logger.info('Notificação falha enfileirada na DLQ', { correlationId, userId, kind });
      } catch (dlqErr) {
        logger.error('Falha ao enfileirar na DLQ', dlqErr, { correlationId, userId, kind });
      }
    })();
  }

  return normalized
}
