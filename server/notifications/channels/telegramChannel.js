import { supabase } from '../../services/supabase.js'
import { escapeMarkdownV2 } from '../../utils/formatters.js'

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'
const EMPTY_RESULT = { channel: 'telegram', success: true, attempted: 0, delivered: 0, failed: 0, deactivatedTokens: [], errors: [] }
const TELEGRAM_CALLBACK_LIMIT = 64

async function getTelegramChatId(userId) {
  if (userId === SYSTEM_USER_ID) return process.env.ADMIN_CHAT_ID
  const { data, error } = await supabase.from('user_settings').select('telegram_chat_id').eq('user_id', userId).single()
  if (error) console.error('[telegramChannel.getTelegramChatId]', { userId, error: error.message })
  return data?.telegram_chat_id || null
}

function encodeCallback(action) {
  const { id, params: p = {} } = action
  let raw
  switch (id) {
    case 'take': raw = `take_:${p.protocolId}:${p.dosage ?? 1}`; break
    case 'snooze': raw = `snooze_:${p.protocolId}`; break
    case 'skip': raw = `skip_:${p.protocolId}`; break
    case 'take_plan': raw = `takeplan:${p.planIdShort}:${p.hhmm}`; break
    case 'take_misc': raw = `takelist:misc:${p.hhmm}`; break
    case 'details': raw = p.kind === 'plan' ? `details:plan:${p.planIdShort}` : `details:misc:${p.hhmm}`; break
    default: return null
  }
  // TODO: Centralize callback limit and refine truncation logic to avoid data corruption.
  // Currently accepting truncation as technical debt due to Telegram 64-byte limit.
  return Buffer.byteLength(raw, 'utf8') <= TELEGRAM_CALLBACK_LIMIT ? raw : raw.slice(0, TELEGRAM_CALLBACK_LIMIT)
}

export async function sendTelegramNotification({ userId, payload, context, bot }) {
  const correlationId = context?.correlationId || 'unknown'
  const chatId = await getTelegramChatId(userId)

  if (!chatId) {
    console.info('[telegramChannel] sem telegram_chat_id', { correlationId, userId })
    return EMPTY_RESULT
  }

  const options = { parse_mode: 'MarkdownV2' }

  if (payload.actions?.length > 0) {
    const buttons = payload.actions
      .map(a => {
        const data = encodeCallback(a)
        return data ? { text: a.label, callback_data: data } : null
      })
      .filter(Boolean)

    if (buttons.length > 0) {
      const singleRow = payload.metadata?.kind === 'dose_reminder'
      options.reply_markup = { inline_keyboard: singleRow ? [buttons] : buttons.map(b => [b]) }
    }
  }

  try {
    const message = payload.title ? `*${escapeMarkdownV2(payload.title)}*\n${payload.body}` : payload.body
    const sentMessage = await bot.sendMessage(chatId, message, options)
    const messageId = sentMessage?.messageId ?? sentMessage?.message_id
    
    console.info('[telegramChannel] entregue', { correlationId, userId, chatId, withButtons: !!options.reply_markup })

    return {
      channel: 'telegram', success: true, attempted: 1, delivered: 1, failed: 0,
      deactivatedTokens: [], errors: [], messageId, providerMetadata: { telegram_message_id: messageId }
    }
  } catch (error) {
    console.error('[telegramChannel] falha no envio', { correlationId, userId, chatId, error: error.message })
    return {
      channel: 'telegram', success: false, attempted: 1, delivered: 0, failed: 1,
      deactivatedTokens: [], errors: [{ message: error.message }]
    }
  }
}
