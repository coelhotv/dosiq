import { shouldSendNow } from '../utils/notificationGate.js'
import { notificationLogRepository } from '../repositories/notificationLogRepository.js'
import { createLogger } from '../../bot/logger.js'
import { sendTelegramNotification } from '../channels/telegramChannel.js'
import { sendExpoPushNotification } from '../channels/expoPushChannel.js'

const logger = createLogger('DispatchHelpers')

export async function dispatchChannel({ channel, userId, payload, context, repositories, bot, expoClient }) {
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

export function checkGatePolicy({ userId, kind, settings, currentHHMM, correlationId }) {
  const isAlert = !['daily_digest'].includes(kind)

  if (!isAlert) return false

  const isQuietEnabled = settings.quiet_hours_enabled ?? false
  
  const shouldSend = shouldSendNow({
    mode: settings.notification_mode || 'realtime',
    quietHoursStart: isQuietEnabled ? settings.quiet_hours_start : null,
    quietHoursEnd: isQuietEnabled ? settings.quiet_hours_end : null,
    currentHHMM
  })

  if (!shouldSend) {
    console.info('[dispatchNotification] suprimida pelo gate', { 
      correlationId, 
      userId, 
      kind, 
      mode: settings.notification_mode,
      quietHours: isQuietEnabled ? `${settings.quiet_hours_start}-${settings.quiet_hours_end}` : 'disabled'
    })
    return true
  }

  return false
}

function buildLogChannels(activeResults) {
  return activeResults.map((res) => ({
    channel:    res.channel,
    status:     res.success ? 'enviada' : 'falhou',
    message_id: res.channel === 'telegram' ? (res.messageId ?? null) : null,
    tickets:    res.channel === 'mobile_push' ? (res.tickets ?? null) : null,
  }))
}

function determineOverallStatus(isSuppressed, activeResults, validChannels) {
  if (isSuppressed) return 'silenciada'
  if (activeResults.some(r => r.success) || (validChannels.length === 0 && !isSuppressed)) return 'enviada'
  return 'falhou'
}

function buildProviderMetadata(metadata, results = [], context = {}) {
  if (!metadata) return {}

  const pm = { ...metadata }
  if (context?.isRetry) pm.isRetry = true

  const telegramRes = results.find(r => r.channel === 'telegram')
  if (telegramRes?.messageId) pm.telegram_message_id = telegramRes.messageId

  // expoPushChannel retorna { tickets: [{ id, status }, ...] }
  const expoRes = results.find(r => r.channel === 'mobile_push')
  const expoTicketId = expoRes?.tickets?.[0]?.id
  if (expoTicketId) pm.expo_ticket_id = expoTicketId

  return pm
}

function buildNotificationLogPayload({ userId, kind, finalPayload, logChannels, overallStatus, firstError, protocolId, results, context }) {
  return {
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
    provider_metadata:    buildProviderMetadata(finalPayload.metadata, results, context),
  }
}

export async function logNotificationEvent({
  userId,
  kind,
  finalPayload,
  results,
  validChannels,
  isSuppressed,
  correlationId,
  context
}) {
  try {
    if (!finalPayload) return

    const protocolId = finalPayload?.metadata?.protocolId ?? null
    
    const activeResults = results.filter(r => r.attempted > 0 || r.errors.length > 0)
    const logChannels = buildLogChannels(activeResults)
    const overallStatus = determineOverallStatus(isSuppressed, activeResults, validChannels)
    const firstError = activeResults.find(r => !r.success)?.errors?.[0]?.message ?? null

    try {
      const logPayload = buildNotificationLogPayload({ userId, kind, finalPayload, logChannels, overallStatus, firstError, protocolId, results, context })
      await notificationLogRepository.create(logPayload)
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
}

export async function enqueueToDlq({
  normalized,
  kind,
  data,
  finalPayload,
  userId,
  repositories,
  context,
  results,
  correlationId
}) {
  if (normalized.totalFailed > 0 && repositories?.dlq && !context?.isRetry) {
    const firstError = results.find(r => !r.success)?.errors?.[0]
    const protocolId = finalPayload?.metadata?.protocolId ?? null

    try {
      await repositories.dlq.enqueue({
        userId,
        protocolId,
        type: kind,
        ...(data || {}) // L1 payload original para futura retentativa
      }, firstError, 1, correlationId)
      logger.info('Notificação falha enfileirada na DLQ', { correlationId, userId, kind })
    } catch (dlqErr) {
      logger.error('Falha ao enfileirar na DLQ', dlqErr, { correlationId, userId, kind })
    }
  }
}
