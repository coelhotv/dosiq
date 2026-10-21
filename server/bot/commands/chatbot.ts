/**
 * Handler para mensagens de texto não-comando no Telegram.
 *
 * Desde a spec 096 (B0) o assistente de IA não roda pelo bot: texto livre recebe
 * uma resposta fixa (copy S13) e nada é enviado a provedor de LLM. O assistente
 * fica só no app, sob o aceite de transferência internacional.
 *
 * @module commands/chatbot
 */

import { createLogger } from '../logger.js'

const logger = createLogger('FreeTextReply')

/** Copy S13 (DESIGN_DECISOES.md §4) — já escapada para MarkdownV2. */
export const FREE_TEXT_REPLY =
  'O assistente agora fica só no app\\. Abra o dosiq e toque no botão de conversa\\.'

/**
 * Responde texto livre com a copy fixa S13.
 *
 * @param {import('node-telegram-bot-api')} bot
 * @param {import('node-telegram-bot-api').Message} msg
 */
export async function handleFreeTextMessage(bot, msg) {
  const chatId = msg.chat.id
  const text = msg.text?.trim()

  // Sem texto (foto/sticker), vazio ou comando: outros handlers cuidam ou nada a fazer
  if (!text || text.startsWith('/')) return

  try {
    await bot.sendMessage(chatId, FREE_TEXT_REPLY, { parse_mode: 'MarkdownV2' })
  } catch (error) {
    logger.error('❌ Erro ao enviar resposta de texto livre', error, {
      chatId,
      errorMessage: error.message,
      errorStatus: error.response?.statusCode,
    })
  }
}
