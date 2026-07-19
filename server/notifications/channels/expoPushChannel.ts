// Canal de notificação Expo Push
// Envia push para todos os devices ativos do usuário (provider = 'expo')
// expoClient é injetado para facilitar testes sem chamadas HTTP reais
// Desativa tokens com erros permanentes via shouldDeactivateDevice (R-042)

import { shouldDeactivateDevice } from '../utils/shouldDeactivateDevice.js'

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
  metadata?: { kind?: string; critical_alarm?: boolean; notificationLogId?: string; [key: string]: unknown }
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

  // Gate per-dose-criticality (Spec 010 / ADR-056):
  // - Dose crítica (critical_alarm=true): push só para devices SEM alarme nativo (fallback).
  //   Devices com native_alarm_enabled recebem o alarme local diretamente.
  // - Dose normal (critical_alarm=false/ausente): push para TODOS os devices
  //   (alarme não suprime doses não-críticas — elas não têm alarme local).
  // - Outros kinds (não dose_reminder): todos os devices recebem normalmente.
  const isDoseReminder = DOSE_REMINDER_KINDS.has(payload?.metadata?.kind ?? '')
  const isCriticalDose = payload?.metadata?.critical_alarm === true

  const devices = isDoseReminder && isCriticalDose
    ? allDevices.filter((d) => !d.native_alarm_enabled)  // crítica: só devices sem alarme (fallback)
    : allDevices  // normal ou não-dose: todos os devices recebem push

  const gatedCount = allDevices.length - devices.length
  if (gatedCount > 0) {
    console.info('[expoPushChannel] push de dose crítica suprimido (alarme nativo)', {
      correlationId,
      userId,
      gated: gatedCount,
      kind: payload?.metadata?.kind,
      critical_alarm: isCriticalDose,
    })
  }

  if (devices.length === 0) {
    console.info('[expoPushChannel] sem devices ativos', { correlationId, userId })
    return {
      channel: 'mobile_push',
      success: true,
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
