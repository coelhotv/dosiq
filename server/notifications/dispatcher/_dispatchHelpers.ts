import { shouldSendNow } from '../utils/notificationGate.js'
import { notificationLogRepository, type NotificationLogCreateInput } from '../repositories/notificationLogRepository.js'
import { createLogger } from '../../bot/logger.js'
import { sendTelegramNotification } from '../channels/telegramChannel.js'
import { sendExpoPushNotification } from '../channels/expoPushChannel.js'
import { sendWebPushNotification } from '../channels/webPushChannel.js'
import type { ChannelResult, ChannelResultReason } from '../utils/normalizeChannelResults.js'

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
      logger.warn('canal desconhecido ignorado', { correlationId, channel })
      return null
    }
  } catch (error: any) {
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
  reason: ChannelResultReason | null
  message_id: string | null
  tickets: Array<{ id?: string; status: string }> | null
}

/** Um canal só entregou se de fato TENTOU. `success` sem tentativa é ausência, não sucesso. */
function hasDelivered(res: ChannelResult): boolean {
  return res.success && (res.attempted ?? 0) > 0
}

function hasAttempted(res: ChannelResult): boolean {
  return (res.attempted ?? 0) > 0
}

/**
 * Status POR CANAL. Recebe todos os resultados (inclusive os sem tentativa — T019/ADR-100), então
 * `res.success` deixou de bastar: um canal sem aparelho volta com `success: true` e nada entregue.
 */
/** Vocabulário do status POR CANAL: entregou · tentou e errou · não chegou a tentar (o `reason` diz por quê). */
function buildLogChannels(results: ChannelResult[]): LogChannel[] {
  return results.map((res) => ({
    channel:    res.channel,
    status:     hasDelivered(res) ? 'enviada' : hasAttempted(res) ? 'falhou' : 'nao_enviada',
    reason:     res.reason ?? null,
    message_id: res.channel === 'telegram' ? (res.messageId ?? null) : null,
    tickets:    res.channel === 'mobile_push' ? (res.tickets ?? null) : null,
  }))
}

/**
 * Converte o que os canais RELATARAM no desfecho da entrega (ADR-100). É aqui — e só aqui — que
 * motivo vira status: o canal informa, o dispatcher decide (R-200).
 *
 * O que havia antes: `results.some(r => r.success) || validChannels.length === 0` ⇒ `'enviada'`.
 * Os dois ramos mentiam. Canal sem aparelho volta `success: true` sem ter tentado nada, e a
 * segunda cláusula transformava "nenhum canal configurado" literalmente em sucesso — as 930
 * linhas `enviada` de 27 pacientes que nada receberam, medidas em 30 dias até 2026-09-10.
 *
 * Precedência quando nada foi tentado:
 *   1. alarme nativo cobre a dose ⇒ `suprimida_alarme`. Vence `sem_canal` de propósito: a
 *      paciente É avisada, pelo alarme do aparelho — o canal ausente ao lado não muda o fato.
 *   2. supressão SEM prova de alarme (FR-012b) ⇒ `suprimida_sem_prova`. Também vence `sem_canal`,
 *      pelo motivo inverso: aqui ninguém avisou a paciente, e essa é a informação que o relatório
 *      diário precisa ver. Nunca colapsar com o caso 1 — lá a dose está coberta, aqui não está.
 *   3. algum canal sem destinatário (ou nenhum canal válido) ⇒ `sem_canal`.
 *   4. qualquer outra coisa (canal inoperante, motivo desconhecido) ⇒ `falhou`. Motivo que este
 *      código não conhece NUNCA vira sucesso.
 */
function determineOverallStatus(isSuppressed: boolean, results: ChannelResult[], validChannels: string[]): string {
  if (isSuppressed) return 'silenciada'

  if (results.some(hasDelivered)) return 'enviada'
  if (results.some(hasAttempted)) return 'falhou'

  if (results.some((r) => r.reason === 'native_alarm')) return 'suprimida_alarme'
  if (results.some((r) => r.reason === 'no_alarm_evidence')) return 'suprimida_sem_prova'
  if (validChannels.length === 0) return 'sem_canal'
  if (results.some((r) => r.reason === 'no_devices' || r.reason === 'no_chat')) return 'sem_canal'

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

    // T019/ADR-100: o filtro que vivia aqui — `attempted > 0 || errors.length > 0` — descartava
    // justamente o resultado que carrega a informação nova. Um canal que não tentou porque o
    // alarme cobre a dose, e um canal que não tentou porque o paciente não tem aparelho, saíam
    // os dois como "nada a relatar" e o status era composto sem eles. Agora `results` chega
    // inteiro ao status e ao log.
    const logChannels = buildLogChannels(results)
    const overallStatus = determineOverallStatus(isSuppressed, results, validChannels)
    // Continua ancorado em `!success`, não em "tem erro": o web push devolve `success: true` COM
    // um erro de configuração (VAPID ausente) e antes ficava de fora do `mensagem_erro`. Agora
    // que `results` chega inteiro, casar por `errors.length > 0` faria uma entrega bem-sucedida
    // pelo Telegram passar a carregar "VAPID keys not configured" — ruído novo, não verdade nova.
    const firstError = results.find((r) => !r.success)?.errors?.[0]?.message ?? null

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
      logger.info('Notificação falha enfileirada na DLQ', { correlationId, userId, kind })
    } catch (dlqErr: any) {
      logger.error('Falha ao enfileirar na DLQ', dlqErr, { correlationId, userId, kind })
    }
  }
}
