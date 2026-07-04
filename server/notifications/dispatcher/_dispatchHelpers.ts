import { shouldSendNow } from '../utils/notificationGate'
import { notificationLogRepository, type NotificationLogCreateInput } from '../repositories/notificationLogRepository'
import { createLogger } from '../../bot/logger.js'
import { sendTelegramNotification } from '../channels/telegramChannel'
import { sendExpoPushNotification } from '../channels/expoPushChannel'
import { sendWebPushNotification } from '../channels/webPushChannel'
import type { ChannelResult } from '../utils/normalizeChannelResults'

const logger = createLogger('DispatchHelpers')

interface DispatchContext {
  correlationId?: string
  isRetry?: boolean
  details?: Record<string, unknown>
}

interface DispatchNotificationPayload {
  title?: string
  body: string
  pushBody?: string
  deeplink?: string | null
  actions?: Array<{ id: string; label: string; params?: Record<string, unknown> }>
  metadata?: { kind?: string; critical_alarm?: boolean; medicineName?: string; protocolName?: string; planId?: string; planName?: string; protocolId?: string; [key: string]: unknown }
}

interface DispatchRepositories {
  devices: {
    listActiveByUser(userId: string, provider: string): Promise<Array<{ push_token: string; native_alarm_enabled?: boolean; [key: string]: unknown }>>
    deactivateByToken(token: string): Promise<void>
  }
  dlq?: { enqueue(payload: Record<string, unknown>, firstError: unknown, attempt: number, correlationId?: string): Promise<void> }
}

interface DispatchBot {
  sendMessage(chatId: string, message: string, options: Record<string, unknown>): Promise<{ messageId?: string; message_id?: string } | undefined>
}

interface DispatchExpoClient {
  sendPushNotificationsAsync(messages: unknown[]): Promise<Array<{ status: string; message?: string; id?: string; details?: { error?: string } }>>
}

interface DispatchChannelParams {
  channel: string
  userId: string
  payload: DispatchNotificationPayload
  context: DispatchContext
  repositories: DispatchRepositories
  bot: DispatchBot
  expoClient: DispatchExpoClient
}

export async function dispatchChannel({ channel, userId, payload, context, repositories, bot, expoClient }: DispatchChannelParams): Promise<ChannelResult | null> {
  const correlationId = context.correlationId
  try {
    if (channel === 'telegram') {
      return await sendTelegramNotification({ userId, payload, context, bot })
    } else if (channel === 'mobile_push') {
      return await sendExpoPushNotification({ userId, payload, context, repositories, expoClient })
    } else if (channel === 'web_push') {
      return await sendWebPushNotification({ userId, payload, context, repositories })
    } else {
      logger.warn('canal desconhecido ignorado', { correlationId, channel } as unknown as undefined)
      return null
    }
  } catch (error: any) {
    logger.error('canal falhou', error, { correlationId, userId, channel } as unknown as undefined)
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

interface GateSettings {
  notification_mode?: string
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
}

interface CheckGatePolicyParams {
  userId: string
  kind: string
  settings: GateSettings
  currentHHMM: string
  correlationId?: string
}

export function checkGatePolicy({ userId, kind, settings, currentHHMM, correlationId }: CheckGatePolicyParams): boolean {
  const isAlert = !['daily_digest'].includes(kind)

  if (!isAlert) return false

  const isQuietEnabled = settings.quiet_hours_enabled ?? false

  const shouldSend = shouldSendNow({
    mode: settings.notification_mode || 'realtime',
    quietHoursStart: isQuietEnabled ? (settings.quiet_hours_start ?? null) : null,
    quietHoursEnd: isQuietEnabled ? (settings.quiet_hours_end ?? null) : null,
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

interface LogChannel {
  channel: string
  status: string
  message_id: string | null
  tickets: Array<{ id?: string; status: string }> | null
}

function buildLogChannels(activeResults: ChannelResult[]): LogChannel[] {
  return activeResults.map((res) => ({
    channel:    res.channel,
    status:     res.success ? 'enviada' : 'falhou',
    message_id: res.channel === 'telegram' ? (res.messageId ?? null) : null,
    tickets:    res.channel === 'mobile_push' ? (res.tickets ?? null) : null,
  }))
}

function determineOverallStatus(isSuppressed: boolean, activeResults: ChannelResult[], validChannels: string[]): string {
  if (isSuppressed) return 'silenciada'
  if (activeResults.some((r) => r.success) || (validChannels.length === 0 && !isSuppressed)) return 'enviada'
  return 'falhou'
}

function buildProviderMetadata(metadata: Record<string, unknown> | undefined, results: ChannelResult[] = [], context: DispatchContext = {}): Record<string, unknown> {
  if (!metadata) return {}

  const pm: Record<string, unknown> = { ...metadata }
  if (context?.isRetry) pm.isRetry = true

  const telegramRes = results.find((r) => r.channel === 'telegram')
  if (telegramRes?.messageId) pm.telegram_message_id = telegramRes.messageId

  // expoPushChannel retorna { tickets: [{ id, status }, ...] }
  const expoRes = results.find((r) => r.channel === 'mobile_push')
  const expoTicketId = expoRes?.tickets?.[0]?.id
  if (expoTicketId) pm.expo_ticket_id = expoTicketId

  return pm
}

interface BuildNotificationLogPayloadParams {
  userId: string
  kind: string
  finalPayload: DispatchNotificationPayload
  logChannels: LogChannel[]
  overallStatus: string
  firstError: string | null
  protocolId: string | null
  results: ChannelResult[]
  context: DispatchContext
}

function buildNotificationLogPayload({ userId, kind, finalPayload, logChannels, overallStatus, firstError, protocolId, results, context }: BuildNotificationLogPayloadParams) {
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
    telegram_message_id:  logChannels.find((c) => c.channel === 'telegram')?.message_id ?? null,
    mensagem_erro:        firstError,
    provider_metadata:    buildProviderMetadata(finalPayload.metadata, results, context),
  }
}

interface LogNotificationEventParams {
  userId: string
  kind: string
  finalPayload: DispatchNotificationPayload
  results: ChannelResult[]
  validChannels: string[]
  isSuppressed: boolean
  correlationId?: string
  context: DispatchContext
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
}: LogNotificationEventParams): Promise<void> {
  try {
    if (!finalPayload) return

    const protocolId = finalPayload?.metadata?.protocolId ?? null

    const activeResults = results.filter((r) => (r.attempted ?? 0) > 0 || (r.errors?.length ?? 0) > 0)
    const logChannels = buildLogChannels(activeResults)
    const overallStatus = determineOverallStatus(isSuppressed, activeResults, validChannels)
    const firstError = activeResults.find((r) => !r.success)?.errors?.[0]?.message ?? null

    try {
      const logPayload = buildNotificationLogPayload({ userId, kind, finalPayload, logChannels, overallStatus, firstError, protocolId, results, context })
      await notificationLogRepository.create(logPayload as unknown as NotificationLogCreateInput)
    } catch (logErr: any) {
      console.error('[dispatchNotification] Falha ao persistir log no DB', {
        correlationId,
        userId,
        error: logErr.message,
      })
    }
  } catch (err: any) {
    console.error('[dispatchNotification] Erro inesperado na rotina de log', {
      correlationId,
      error: err.message,
    })
  }
}

interface EnqueueToDlqParams {
  normalized: { totalFailed: number }
  kind: string
  data: Record<string, unknown> | undefined
  finalPayload: DispatchNotificationPayload
  userId: string
  repositories: DispatchRepositories
  context: DispatchContext
  results: ChannelResult[]
  correlationId?: string
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
}: EnqueueToDlqParams): Promise<void> {
  if (normalized.totalFailed > 0 && repositories?.dlq && !context?.isRetry) {
    const firstError = results.find((r) => !r.success)?.errors?.[0]
    const protocolId = finalPayload?.metadata?.protocolId ?? null

    try {
      await repositories.dlq.enqueue({
        userId,
        protocolId,
        type: kind,
        ...(data || {}) // L1 payload original para futura retentativa
      }, firstError, 1, correlationId)
      logger.info('Notificação falha enfileirada na DLQ', { correlationId, userId, kind } as unknown as undefined)
    } catch (dlqErr: any) {
      logger.error('Falha ao enfileirar na DLQ', dlqErr, { correlationId, userId, kind } as unknown as undefined)
    }
  }
}
