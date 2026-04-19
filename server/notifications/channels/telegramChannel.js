// Canal de notificação Telegram
// Encapsula o adapter Telegram existente (server/bot/)
// Recebe payload canônico e converte para texto MarkdownV2
// bot é injetado para facilitar testes sem chamadas HTTP reais

import { supabase } from '../../services/supabase.js'
import { escapeMarkdownV2 } from '../../utils/formatters.js'

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

// Converte payload canônico em texto MarkdownV2 para Telegram
function formatMessage(payload) {
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

  const message = formatMessage(payload)
  const isDoseReminder = payload.title?.includes('remedia') || payload.deeplink?.includes('protocolId')

  // P1: Re-ativa os botões interativos (Sprint 6.4)
  const options = { parse_mode: 'MarkdownV2' }
  
  if (isDoseReminder && payload.metadata?.protocolId) {
    const { protocolId, dosage } = payload.metadata
    options.reply_markup = {
      inline_keyboard: [
        [
          { text: '✅ Tomar', callback_data: `take_:${protocolId}:${dosage || 1}` },
          { text: '⏰ Adiar', callback_data: `snooze_:${protocolId}` },
          { text: '⏭️ Pular', callback_data: `skip_:${protocolId}` }
        ]
      ]
    }
  }

  try {
    await bot.sendMessage(chatId, message, options)

    console.info('[telegramChannel] entregue', { 
      correlationId, 
      userId, 
      chatId,
      withButtons: !!options.reply_markup 
    })

    return {
      channel: 'telegram',
      success: true,
      attempted: 1,
      delivered: 1,
      failed: 0,
      deactivatedTokens: [],
      errors: [],
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
