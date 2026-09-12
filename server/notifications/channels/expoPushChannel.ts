// Canal de notificação Expo Push
// Envia push para todos os devices ativos do usuário (provider = 'expo')
// expoClient é injetado para facilitar testes sem chamadas HTTP reais
// Desativa tokens com erros permanentes via shouldDeactivateDevice (R-042)

import { shouldDeactivateDevice } from '../utils/shouldDeactivateDevice.js'
import type { ChannelResultReason } from '../utils/normalizeChannelResults.js'

interface ExpoDevice {
  push_token: string
  native_alarm_enabled?: boolean
  [key: string]: unknown
}

interface NotificationPayload {
  title?: string
  body: string
  pushBody?: string
  actions?: Array<{ id: string; label: string; params?: Record<string, unknown> }>
  metadata?: {
    kind?: string
    critical_alarm?: boolean
    notificationLogId?: string
    /** 082 Slice C — decisão de supressão tomada no reminder (FR-013b). Declarada aqui porque o
     *  `[key: string]: unknown` abaixo a entregaria como `unknown` e o motivo viraria `any`. */
    suppress_push_reason?: ChannelResultReason
    [key: string]: unknown
  }
}

interface ExpoTicket {
  status: string
  message?: string
  id?: string
  details?: { error?: string }
}

interface ExpoClient {
  sendPushNotificationsAsync(messages: ReturnType<typeof _buildExpoMessages>): Promise<ExpoTicket[]>
}

interface DeviceRepository {
  listActiveByUser(userId: string, provider: string): Promise<ExpoDevice[]>
  deactivateByToken(token: string): Promise<void>
}

interface Repositories {
  devices: DeviceRepository
}

// Kinds de lembrete de dose — cobertos pelo alarme nativo (Notifee) no mobile.
// Gate de duplicata (Spec 001 A2): devices com native_alarm_enabled NÃO recebem
// push destes kinds (o alarme local já dispara). Outros kinds passam normais.
const DOSE_REMINDER_KINDS = new Set([
  'dose_reminder',
  'dose_reminder_by_plan',
  'dose_reminder_misc',
])

// 029 F5 (T025 / FR-004): kinds que saem TIME-SENSITIVE mesmo sem serem dose crítica.
// O `medicine_switch` da Evolução do tratamento é acionável e temporal (a etapa começa hoje),
// então precisa furar Focus/DND — mas NÃO é alarme: som e canal seguem os normais.
// `dose_change` é informativo e cai no 'active' padrão; o gate olha as AÇÕES do payload, que só
// existem no switch (Decisões §3.1/§3.4), evitando um segundo lugar onde a distinção é decidida.
const TIME_SENSITIVE_KINDS = new Set(['titration_alert'])

function _isTimeSensitive(payload: NotificationPayload, isCriticalDose: boolean): boolean {
  if (isCriticalDose) return true
  const kind = payload?.metadata?.kind ?? ''
  return TIME_SENSITIVE_KINDS.has(kind) && (payload.actions?.length ?? 0) > 0
}

// Categoria de ações da Evolução do tratamento. DEVE casar com o id registrado no app
// (`ensureTitrationCategories`) — `categoryId` no payload só REFERENCIA uma categoria; se ela
// não existir no device, o iOS entrega a notificação SEM botões, em silêncio.
export const TITRATION_CATEGORY_ID = 'dosiq-titration-v1'

// Constrói a lista de mensagens formatadas para o formato do Expo Push.
function _buildExpoMessages(devices: ExpoDevice[], payload: NotificationPayload, isCriticalDose: boolean) {
  const timeSensitive = _isTimeSensitive(payload, isCriticalDose)
  const actions = payload.actions ?? []
  // Só anexa categoria quando há ação — categoria vazia é botão fantasma.
  const categoryId = actions.length > 0 && payload?.metadata?.kind === 'titration_alert'
    ? TITRATION_CATEGORY_ID
    : null

  return devices.map((device) => ({
    to: device.push_token,
    sound: isCriticalDose ? 'alarm_dose.wav' : 'push_chime.wav',
    // Furo de Focus/DND no iOS (doses essenciais e switch da evolução vão 'time-sensitive').
    interruptionLevel: timeSensitive ? 'time-sensitive' : 'active',
    // --- v1 (configuração com objeto que exige permissão especial de Critical Alerts no iOS):
    // sound: { name: isCriticalDose ? 'alarm_dose.wav' : 'push_chime.wav' },
    // --- v2 (pós-aprovação do entitlement Critical Alerts pela Apple — spec 010/FR-005):
    //     fura o mudo físico no lock screen. Trocar as 3 linhas acima por:
    //     sound: { critical: true, name: isCriticalDose ? 'alarm_dose.wav' : 'push_chime.wav', volume: 1.0 },
    //     interruptionLevel: 'critical',
    channelId: isCriticalDose ? 'dosiq-critical-v1' : 'dosiq-default-v1',
    ...(categoryId ? { categoryId } : {}),
    title: payload.title,
    body: payload.pushBody || payload.body,
    data: {
      ...(payload.metadata ?? {}),
      notificationLogId: payload.metadata?.notificationLogId ?? null,
      // As ações viajam no data porque o handler do app precisa dos `params` (o `stepId` que o
      // `confirm_titration_switch` consome) — o categoryId só desenha os botões, não carrega dado.
      ...(actions.length > 0 ? { actions } : {}),
    },
  }))
}

// Executa o envio em lote das notificações via expoClient com fallback individual.
async function _sendPushNotifications(expoClient: ExpoClient, messages: ReturnType<typeof _buildExpoMessages>, correlationId: string, userId: string): Promise<ExpoTicket[]> {
  try {
    return await expoClient.sendPushNotificationsAsync(messages)
  } catch (error: unknown) {
    // Se falhar o lote inteiro por conflito de projeto (comum em migrações de marca),
    // tentamos o envio individual para permitir que os tokens do projeto novo passem
    // e os antigos sejam identificados/desativados.
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('All push notification messages in the same request must be for the same project')) {
      console.warn('[expoPushChannel] conflito de projeto detectado, tentando envio individual...', { correlationId, userId })
      const tickets: ExpoTicket[] = []
      for (const msg of messages) {
        try {
          const [ticket] = await expoClient.sendPushNotificationsAsync([msg])
          tickets.push(ticket)
        } catch (individualError: unknown) {
          // Se falhou individualmente, simulamos um ticket de erro para ser tratado no normalize
          tickets.push({
            status: 'error',
            message: individualError instanceof Error ? individualError.message : String(individualError),
            details: { error: 'DeviceNotRegistered' } // Forçamos desativação se o projeto não bate
          })
        }
      }
      return tickets
    }
    throw error
  }
}

/**
 * Por que o canal não tem ninguém para quem enviar (ADR-100). Extraído da função de envio de
 * propósito: inline, o ternário empurrava `sendExpoPushNotification` de 15 para 16 de
 * complexidade ciclomática — o limite do lint.
 *
 * 082 Slice C: a supressão deixou de nascer aqui (o `native_alarm_enabled` do aparelho, que hoje
 * é `true` em 9 de 9 devices e significa apenas "o app abriu uma vez"). Quem decide é o reminder,
 * por OCORRÊNCIA, e manda o motivo em `suppress_push_reason`.
 *
 * ⚠️ `no_devices` tem PRECEDÊNCIA sobre a supressão (decisão D-C1 do C1.5): sem nenhum aparelho
 * ativo não havia push a suprimir, e o desfecho honesto é ausência de canal — o `sem_canal` que o
 * Slice B persegue. Sem esta ordem, pacientes sem aparelho algum entrariam no silêncio residual do
 * D1, atribuindo ao gate um silêncio que é falta de canal e inflando o SC-002a com população que
 * ele não descreve (medido: 8 das 47 doses críticas de 7 dias).
 */
function _resolveEmptyReason(hadDevices: boolean, suppressReason?: ChannelResultReason): ChannelResultReason {
  if (!hadDevices) return 'no_devices'
  return suppressReason ?? 'no_devices'
}

/**
 * A decisão de supressão que o reminder mandou, se ela se aplica a este payload (082 Slice C).
 * Extraída da função de envio pelo mesmo motivo de `_resolveEmptyReason`: inline, os dois ramos
 * estouram o limite de complexidade ciclomática do lint.
 */
function _resolveSuppressReason(
  payload: NotificationPayload,
  isDoseReminder: boolean,
  isCriticalDose: boolean
): ChannelResultReason | undefined {
  if (!isDoseReminder || !isCriticalDose) return undefined
  return payload?.metadata?.suppress_push_reason
}

interface LogSuppressionParams {
  suppressReason?: ChannelResultReason
  deviceCount: number
  correlationId: string
  userId: string
  payload: NotificationPayload
  isCriticalDose: boolean
}

function _logSuppression({ suppressReason, deviceCount, correlationId, userId, payload, isCriticalDose }: LogSuppressionParams): void {
  if (!suppressReason || deviceCount === 0) return
  console.info('[expoPushChannel] push de dose crítica suprimido por decisão do reminder', {
    correlationId,
    userId,
    gated: deviceCount,
    reason: suppressReason,
    kind: payload?.metadata?.kind,
    critical_alarm: isCriticalDose,
  })
}

interface SendExpoPushParams {
  userId: string
  payload: NotificationPayload
  context?: { correlationId?: string }
  repositories: Repositories
  expoClient: ExpoClient
}

export async function sendExpoPushNotification({ userId, payload, context, repositories, expoClient }: SendExpoPushParams) {
  const correlationId = context?.correlationId || 'unknown'

  const allDevices = await repositories.devices.listActiveByUser(userId, 'expo')

  // Gate per-dose-criticality (Spec 010 / ADR-056 · 082 Slice C):
  // - Dose crítica (critical_alarm=true): o push é suprimido SÓ quando o reminder mandou
  //   `suppress_push_reason` — ou seja, quando existe PROVA de alarme para aquela ocorrência, ou
  //   quando a ausência de prova é ambígua (usuário incapaz de produzi-la, D1).
  //   O filtro por `native_alarm_enabled` NÃO se aplica mais aqui (RC3/F3): a flag nasce `true` por
  //   omissão no registro do device e está `true` em 9 de 9 aparelhos ativos — ela significa "o app
  //   abriu uma vez", não "o alarme desta dose está armado". Era ela que suprimia o push de quem
  //   ficava dias sem abrir o app, exatamente quem não tinha alarme armado.
  // - Dose normal (critical_alarm=false/ausente): push para TODOS os devices (FR-014, R-191 intacto).
  // - Outros kinds (não dose_reminder): todos os devices recebem normalmente.
  const isDoseReminder = DOSE_REMINDER_KINDS.has(payload?.metadata?.kind ?? '')
  const isCriticalDose = payload?.metadata?.critical_alarm === true
  const suppressReason = _resolveSuppressReason(payload, isDoseReminder, isCriticalDose)

  const devices = suppressReason ? [] : allDevices
  _logSuppression({ suppressReason, deviceCount: allDevices.length, correlationId, userId, payload, isCriticalDose })

  if (devices.length === 0) {
    // Dois desfechos MUITO diferentes que antes saíam idênticos daqui (ADR-100): o gate zerou a
    // lista (o alarme local cobre a dose — supressão deliberada) ou o usuário não tem aparelho
    // algum (ninguém foi avisado). O canal só informa qual dos dois; quem vira status é o
    // dispatcher (R-200).
    const reason = _resolveEmptyReason(allDevices.length > 0, suppressReason)
    console.info('[expoPushChannel] nada a enviar', { correlationId, userId, reason })
    return {
      channel: 'mobile_push',
      success: true,
      reason,
      attempted: 0,
      delivered: 0,
      failed: 0,
      deactivatedTokens: [],
      errors: [],
    }
  }

  const messages = _buildExpoMessages(devices, payload, isCriticalDose)

  let tickets: ExpoTicket[]
  try {
    tickets = await _sendPushNotifications(expoClient, messages, correlationId, userId)
  } catch (error: any) {
    console.error('[expoPushChannel] falha fatal ao enviar para Expo', { correlationId, userId, error: error.message })
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

interface NormalizeExpoResultParams {
  devices: ExpoDevice[]
  tickets: ExpoTicket[]
  repositories: Repositories
  correlationId: string
  userId: string
}

async function normalizeExpoResult({ devices, tickets, repositories, correlationId, userId }: NormalizeExpoResultParams) {
  let delivered = 0
  let failed = 0
  const errors: Array<{ token: string; code?: string; message?: string }> = []
  const tokensToDeactivate: string[] = []

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
    tickets: tickets.map(t => ({ id: t.id, status: t.status })),
    providerMetadata: { expo_tickets: tickets }
  }
}
