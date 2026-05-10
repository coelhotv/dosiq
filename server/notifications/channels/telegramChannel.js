// Canal de notificação Telegram
// Encapsula o adapter Telegram existente (server/bot/)
// Recebe payload canônico e converte para texto MarkdownV2
// bot é injetado para facilitar testes sem chamadas HTTP reais

import { getTelegramChatId, formatMessage, buildTelegramReplyMarkup, inferTelegramKind } from './_telegramHelpers.js'

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

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

  const chatId = userId === SYSTEM_USER_ID 
    ? process.env.ADMIN_CHAT_ID 
    : await getTelegramChatId(userId)

  if (!chatId) {
    console.info('[telegramChannel] sem telegram_chat_id', { correlationId, userId })
    return EMPTY_RESULT
  }

  // Inferir kind via metadata (explícito do dispatcher) ou deeplink como fallback
  const kind = inferTelegramKind(payload)

  const message = formatMessage({ ...payload, kind })

  // Botões interativos por kind (R-030: callback_data < 64 bytes)
  const options = { parse_mode: 'MarkdownV2' }
  const reply_markup = buildTelegramReplyMarkup(payload)
  if (reply_markup) {
    options.reply_markup = reply_markup
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
