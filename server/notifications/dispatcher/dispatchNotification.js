// Dispatcher central de notificações multicanal (ADR-029)
// Recebe lista de canais resolvidos por resolveChannelsForUser e delega a cada canal
// Falha de um canal não cancela os demais (Promise.allSettled por canal)
// correlationId é obrigatório em todos os logs (R-087)

import { z } from 'zod'
import { sendTelegramNotification } from '../channels/telegramChannel.js'
import { sendExpoPushNotification } from '../channels/expoPushChannel.js'
import { normalizeChannelResults } from '../utils/normalizeChannelResults.js'
import { notificationLogRepository } from '../repositories/notificationLogRepository.js'
import { shouldSendNow } from '../utils/notificationGate.js'

const dispatchInputSchema = z.object({
  userId: z.string().min(1),
  kind: z.enum([
    'dose_reminder', 
    'dose_reminder_by_plan', 
    'dose_reminder_misc', 
    'stock_alert', 
    'daily_digest',
    'weekly_adherence',
    'monthly_report',
    'titration_alert',
    'prescription_alert',
    'adherence_report'
  ]),
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

  // --- Wave N2: Centralized Gate Policy ---
  let isSuppressed = false
  const isAlert = !['daily_digest', 'weekly_adherence', 'monthly_report'].includes(kind)

  if (isAlert) {
    const settings = await repositories.preferences.getSettingsByUserId(userId)
    const now = new Date()
    // TODO: Usar luxon ou date-fns para timezone correto se necessário, 
    // mas shouldSendNow usa HH:MM string que simplifica
    const currentHHMM = now.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false,
      timeZone: settings.timezone || 'America/Sao_Paulo'
    })

    const isQuietEnabled = settings.quiet_hours_enabled ?? false
    
    if (isQuietEnabled && !shouldSendNow({
      mode: settings.notification_mode,
      quietHoursStart: settings.quiet_hours_start,
      quietHoursEnd: settings.quiet_hours_end,
      currentHHMM
    })) {
      isSuppressed = true
      console.info('[dispatchNotification] suprimida pelo gate', { correlationId, userId, kind, mode: settings.notification_mode })
    }
  }

  if (validChannels.length === 0 && !isSuppressed) {
    console.info('[dispatchNotification] nenhum canal físico ativo — prosseguindo apenas com log (Inbox-First)', { correlationId, userId, kind })
    // Não retornamos mais; deixamos seguir para a rotina de log
  }

  console.info('[dispatchNotification] iniciando', { 
    correlationId, 
    userId, 
    kind, 
    channels: validChannels,
    suppressed: isSuppressed 
  })

  let results = []
  if (!isSuppressed && validChannels.length > 0) {
    const settledResults = await Promise.allSettled(
      validChannels.map((channel) => dispatchChannel({ channel, userId, payload, context: ctx, repositories, bot, expoClient }))
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
  // Fire-and-forget: não trava o retorno para o cron/request original
  ;(async () => {
    try {
      // Wave 12: Sempre logar se houver payload, mesmo sem canais físicos, para alimentar a Inbox
      if (!payload) return;

      const isGroupedKind = kind === 'dose_reminder_by_plan' || kind === 'dose_reminder_misc'
      const protocolId = isGroupedKind ? null : (payload?.metadata?.protocolId ?? null)
      
      // Filtra canais sem tentativa e sem erro (ex: nenhum device registrado)
      const activeResults = results.filter(r => r.attempted > 0 || r.errors.length > 0)

      // Consolida canais num único array para o log
      const logChannels = activeResults.map((res) => ({
        channel:    res.channel,
        status:     res.success ? 'enviada' : 'falhou',
        message_id: res.channel === 'telegram' ? (res.messageId ?? null) : null,
        tickets:    res.channel === 'mobile_push' ? (res.tickets ?? null) : null,
      }))

      // Status geral: enviada se ao menos um canal teve sucesso, falhou se todos falharam, silenciada,
      // ou enviada se for apenas Inbox (sem canais físicos mas não suprimida)
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
          title:                payload.title ?? null,
          body:                 payload.body ?? null,
          medicine_name:        payload.metadata?.medicineName ?? null,
          protocol_name:        payload.metadata?.protocolName ?? null,
          treatment_plan_id:    payload.metadata?.planId ?? null,
          treatment_plan_name:  payload.metadata?.planName ?? null,
          status:               overallStatus,
          channels:             logChannels,
          telegram_message_id:  logChannels.find(c => c.channel === 'telegram')?.message_id ?? null,
          mensagem_erro:        firstError,
          provider_metadata: {
            ...(payload.metadata?.protocolIds ? { protocol_ids: payload.metadata.protocolIds } : {}),
            ...(payload.metadata?.planId ? { treatment_plan_id: payload.metadata.planId } : {}),
            // M2.5: Metadados de adesão para Inbox
            ...(payload.metadata?.percentage !== undefined ? { percentage: payload.metadata.percentage } : {}),
            ...(payload.metadata?.expected_doses !== undefined ? { expected_doses: payload.metadata.expected_doses } : {}),
            ...(payload.metadata?.taken_doses !== undefined ? { taken_doses: payload.metadata.taken_doses } : {}),
            ...(payload.metadata?.nudge ? { nudge: payload.metadata.nudge } : {}),
            ...(payload.metadata?.storytelling ? { storytelling: payload.metadata.storytelling } : {}),
            ...(payload.metadata?.details ? { details: payload.metadata.details } : {}),
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
