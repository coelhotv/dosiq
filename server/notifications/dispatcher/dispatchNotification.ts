// Dispatcher central de notificações multicanal (ADR-029)
import { createLogger } from '../../bot/logger.js'
// Recebe lista de canais resolvidos por resolveChannelsForUser e delega a cada canal
// Falha de um canal não cancela os demais (Promise.allSettled por canal)
// correlationId é obrigatório em todos os logs (R-087)

import { z } from 'zod'
import { buildNotificationPayload, kindSchema } from '../payloads/buildNotificationPayload.js'
import { resolveChannelsForUser } from '../policies/resolveChannelsForUser.js'
import { isConsentSuppressed } from '../policies/consentSuppression.js'
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
import type { ChannelResult } from '../utils/normalizeChannelResults.js'
import type { NotificationSettings, NotificationPreference } from '../repositories/notificationPreferenceRepository.js'
import type { NotificationDevice } from '../repositories/notificationDeviceRepository.js'

interface DispatchNotificationParams {
  userId: string
  kind: string
  data: Record<string, unknown> & { critical_alarm?: boolean }
  channels?: string[]
  context?: { correlationId?: string; isRetry?: boolean; details?: Record<string, unknown> }
  repositories: {
    devices: { listActiveByUser(userId: string, provider?: string): Promise<NotificationDevice[]>; deactivateByToken(token: string): Promise<void> }
    preferences: {
      hasTelegramChat(userId: string): Promise<boolean>
      getByUserId(userId: string): Promise<NotificationPreference>
      getSettingsByUserId(userId: string): Promise<NotificationSettings>
    }
    dlq?: { enqueue(payload: Record<string, unknown>, firstError: unknown, attempt: number, correlationId?: string): Promise<void> }
  }
  bot: { sendMessage(chatId: string, message: string, options: Record<string, unknown>): Promise<{ messageId?: string; message_id?: string } | undefined> }
  expoClient: { sendPushNotificationsAsync(messages: unknown[]): Promise<Array<{ status: string; message?: string; id?: string; details?: { error?: string } }>> }
}

/**
 * Resolve canais físicos válidos e a flag isCritical. Extraído para reduzir a
 * complexidade de dispatchNotification (R-122) — mesma lógica, sem efeito colateral extra.
 */
async function _resolveValidChannels({
  userId,
  kind,
  data,
  channels,
  repositories,
}: Pick<DispatchNotificationParams, 'userId' | 'kind' | 'data' | 'channels' | 'repositories'>) {
  const isCritical = ['dose_reminder', 'dose_reminder_by_plan', 'dose_reminder_misc'].includes(kind) && data?.critical_alarm === true
  let validChannels = channels ?? []

  if (validChannels.length === 0) {
    validChannels = await resolveChannelsForUser({ userId, repositories, isCritical })
  } else if (isCritical) {
    // Se o canal foi passado de forma explícita mas é uma dose essencial/crítica,
    // garante que 'mobile_push' esteja presente se o usuário possuir dispositivos ativos.
    const activeExpoDevices = await repositories.devices.listActiveByUser(userId, 'expo')
    if (activeExpoDevices.length > 0 && !validChannels.includes('mobile_push')) {
      validChannels = [...validChannels, 'mobile_push']
    }
  }

  return { validChannels }
}

export async function dispatchNotification({ userId, kind, data, channels, context, repositories, bot, expoClient }: DispatchNotificationParams) {
  const parsed = dispatchInputSchema.safeParse({ userId, kind, channels: channels ?? [] })
  if (!parsed.success) {
    throw new Error(`[dispatchNotification] Entrada inválida: ${parsed.error.message}`)
  }

  const correlationId = context?.correlationId || `dispatch_${getNow().getTime()}`
  const ctx = { ...context, correlationId }

  // Resolve channels if not provided
  const { validChannels } = await _resolveValidChannels({ userId, kind, data, channels: parsed.data.channels, repositories })

  // dispatcher sempre chama o builder internamente. Callers passam apenas { kind, data, context }.
  const finalPayload = buildNotificationPayload({ kind, data, context: ctx })

  // --- Wave N2: Centralized Gate Policy ---
  let isSuppressed = false
  const settings = await repositories.preferences.getSettingsByUserId(userId)
  const currentHHMM = getCurrentTime()

  // 046 T014 — consentimento REVOGADO suspende TODA notificação, de qualquer kind. Fica aqui, no
  // funil por onde toda notificação passa, e não job a job: filtrar em cinco jobs significa lembrar
  // do sexto quando ele nascer; aqui, um kind novo já nasce coberto.
  //
  // O estado vem do MESMO fetch de settings logo acima (`consent_revoked_at`) — sem query nova e sem
  // leitura global. É o que garante o isolamento: um erro ao ler a linha DESTE usuário suprime só
  // ele (fail-closed por usuário), e nunca a necessidade clínica dos outros pacientes.
  // O `kind` entra aqui por causa do aviso de prune (T013d): ele é dirigido a quem revogou e não
  // trata dado de saúde — ver CONSENT_LIFECYCLE_KINDS. Todo o resto segue suprimido.
  if (isConsentSuppressed(settings, kind)) {
    logger.info('Notificação suprimida — consentimento de dado de saúde revogado (ou estado ilegível)', {
      correlationId, userId, kind
    })
    return normalizeChannelResults([])
  }

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

  let results: ChannelResult[] = []
  if (!isSuppressed && validChannels.length > 0) {
    const settledResults = await Promise.allSettled(
      validChannels.map((channel) => dispatchChannel({ channel, userId, payload: finalPayload, context: ctx, repositories, bot, expoClient }))
    )

    results = settledResults
      .map((r, i): ChannelResult | null => {
        if (r.status === 'rejected') {
          const reasonMessage = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error('[dispatchNotification] canal rejeitou promise', { correlationId, channel: validChannels[i], reason: reasonMessage })
          return { channel: validChannels[i], success: false, attempted: 0, delivered: 0, failed: 0, deactivatedTokens: [], errors: [{ message: reasonMessage }] }
        }
        return r.value
      })
      .filter((r): r is ChannelResult => r !== null)
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
      correlationId,
      context: ctx
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
      context: ctx,
      results,
      correlationId
    })
  })()

  return normalized
}
