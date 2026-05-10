import { supabase } from '../../services/supabase.js'
import { escapeMarkdownV2 } from '../../utils/formatters.js'

/**
 * Obtém o telegram_chat_id de um usuário.
 */
export async function getTelegramChatId(userId) {
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
 * Formata a mensagem para o Telegram usando o payload canônico.
 */
export function formatMessage(payload) {
  // A Layer 2 já fornece title e body prontos. 
  // O title é escapado aqui por segurança, mas o body já vem com MarkdownV2 da L2.
  const title = escapeMarkdownV2(payload.title)
  const body = payload.body
  return `*${title}*\n${body}`
}

/**
 * Infere o tipo de notificação para retrocompatibilidade ou lógica interna.
 */
export function inferTelegramKind(payload) {
  return payload.metadata?.kind || 'dose_reminder'
}

/**
 * Constrói o reply_markup do Telegram a partir das ações canônicas.
 */
export function buildTelegramReplyMarkup(payload) {
  const actions = payload.actions || []
  if (actions.length === 0) return undefined

  const keyboard = actions.map(action => {
    let callbackData = ''
    const p = action.params || {}
    
    switch (action.id) {
      case 'take':
        // Legado: take_:protocolId:dosage
        callbackData = `take_:${p.protocolId}:${p.dosage ?? 1}`
        break
      case 'snooze':
        // Legado: snooze_:protocolId
        callbackData = `snooze_:${p.protocolId}`
        break
      case 'skip':
        // Legado: skip_:protocolId
        callbackData = `skip_:${p.protocolId}`
        break
      case 'take_plan':
        // Novo: takeplan:planIdShort:hhmm
        callbackData = `takeplan:${p.planIdShort}:${p.hhmm}`
        break
      case 'take_misc':
        // Novo: takelist:misc:hhmm
        callbackData = `takelist:misc:${p.hhmm}`
        break
      case 'details':
        // Novo: details:kind:id
        callbackData = `details:${p.kind}:${p.planIdShort || p.hhmm}`
        break
      default:
        return null
    }

    return { text: action.label, callback_data: callbackData }
  }).filter(Boolean)

  if (keyboard.length === 0) return undefined

  // Colocamos os botões empilhados (um por linha) para melhor usabilidade mobile
  return { inline_keyboard: keyboard.map(button => [button]) }
}
