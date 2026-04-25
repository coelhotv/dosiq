// Canal de notificação Telegram
// Encapsula o adapter Telegram existente (server/bot/)
// Recebe payload canônico e converte para texto MarkdownV2
// bot é injetado para facilitar testes sem chamadas HTTP reais

import { supabase } from '../../services/supabase.js'
import { escapeMarkdownV2 } from '../../utils/formatters.js'
import {
  formatDoseGroupedByPlanMessage,
  formatDoseGroupedMiscMessage,
} from '../../bot/utils/doseFormatters.js'

// Retorna telegram_chat_id do usuário ou null se não configurado
async function getTelegramChatId(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('telegram_chat_id')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[telegramChannel.getTelegramChatId]', { userId, error: error.message })
    return null
  }

  return data?.telegram_chat_id || null
}

/**
 * Converte payload canônico em texto MarkdownV2 para Telegram.
 * Kinds by_plan e misc usam formatters ricos com lista de doses.
 * @param {object} payload - Payload normalizado por buildNotificationPayload
 * @returns {string} Mensagem MarkdownV2
 */
function formatMessage(payload) {
  const { metadata } = payload

  if (payload.kind === 'dose_reminder_by_plan' && metadata?.doses) {
    return formatDoseGroupedByPlanMessage(
      metadata.planName,
      metadata.doses,
      metadata.scheduledTime,
      metadata.hour,
    )
  }

  if (payload.kind === 'dose_reminder_misc' && metadata?.doses) {
    return formatDoseGroupedMiscMessage(
      metadata.doses,
      metadata.scheduledTime,
      metadata.hour,
    )
  }

  const title = escapeMarkdownV2(payload.title)
  const body = escapeMarkdownV2(payload.body)
  return `*${title}*\n${body}`
}

// Shape padronizado de retorno de canal
const EMPTY_RESULT = {
  channel: 'telegram',
  success: true,
  attempted: 0,
  delivered: 0,
  failed: 0,
  deactivatedTokens: [],
  errors: [],
}

export async function sendTelegramNotification({ userId, payload, context, bot }) {
  const correlationId = context?.correlationId || 'unknown'

  const chatId = await getTelegramChatId(userId)

  if (!chatId) {
    console.info('[telegramChannel] sem telegram_chat_id', { correlationId, userId })
    return EMPTY_RESULT
  }

  // Inferir kind via metadata (explícito do dispatcher) ou deeplink como fallback
  const kind = payload.metadata?.kind ?? (payload.deeplink?.includes('plan=') ? 'dose_reminder_by_plan' :
                                          payload.deeplink?.includes('misc=1') ? 'dose_reminder_misc' :
                                          'dose_reminder')

  const message = formatMessage({ ...payload, kind })

  // Botões interativos por kind (R-030: callback_data < 64 bytes)
  const options = { parse_mode: 'MarkdownV2' }

  if (kind === 'dose_reminder_by_plan' && payload.metadata?.planId) {
    // Sprint 1.2: planIdx será adicionado quando callbacks forem implementados
    // Por ora, usar planId truncado para manter < 64 bytes
    const planIdShort = String(payload.metadata.planId).slice(0, 8)
    const hhmm = payload.metadata.scheduledTime ?? '00:00'
    options.reply_markup = {
      inline_keyboard: [[
        { text: '✅ Registrar este plano', callback_data: `takeplan:${planIdShort}:${hhmm}` },
        { text: '📋 Detalhes', callback_data: `details:plan:${planIdShort}` },
      ]]
    }
  } else if (kind === 'dose_reminder_misc' && payload.metadata?.protocolIds?.length) {
    const hhmm = payload.metadata.scheduledTime ?? '00:00'
    options.reply_markup = {
      inline_keyboard: [[
        { text: '✅ Registrar todos', callback_data: `takelist:misc:${hhmm}` },
        { text: '📋 Detalhes', callback_data: `details:misc:${hhmm}` },
      ]]
    }
  } else if (payload.metadata?.protocolId) {
    const { protocolId, dosage } = payload.metadata
    options.reply_markup = {
      inline_keyboard: [[
        { text: '✅ Tomar', callback_data: `take_:${protocolId}:${dosage || 1}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${protocolId}` },
        { text: '⏭️ Pular', callback_data: `skip_:${protocolId}` }
      ]]
    }
  }

  try {
    const sentMessage = await bot.sendMessage(chatId, message, options)

    console.info('[telegramChannel] entregue', { 
      correlationId, 
      userId, 
      chatId,
      withButtons: !!options.reply_markup 
    })

    const messageId = sentMessage?.messageId ?? sentMessage?.message_id;
    if (!messageId) {
      console.error('[telegramChannel] Resposta do bot sem message_id', { correlationId, userId, result: sentMessage });
    }

    return {
      channel: 'telegram',
      success: true,
      attempted: 1,
      delivered: 1,
      failed: 0,
      deactivatedTokens: [],
      errors: [],
      messageId,
      providerMetadata: { telegram_message_id: messageId }
    }
  } catch (error) {
    console.error('[telegramChannel] falha no envio', { correlationId, userId, chatId, error: error.message })

    return {
      channel: 'telegram',
      success: false,
      attempted: 1,
      delivered: 0,
      failed: 1,
      deactivatedTokens: [],
      errors: [{ message: error.message }],
    }
  }
}
