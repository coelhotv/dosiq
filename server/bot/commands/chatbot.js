/**
 * Handler para mensagens de texto não-comando no Telegram.
 *
 * Intercepta mensagens que NÃO começam com '/' e as encaminha
 * para o chatbot IA (Groq) com contexto personalizado do paciente.
 *
 * Requer: GROQ_API_KEY no env
 *
 * @module commands/chatbot
 */

import { getUserIdByChatId } from '../../services/userService.js'
import { sendTelegramChatMessage } from '../services/chatbotServerService.js'
import { createLogger } from '../logger.js'

const logger = createLogger('ChatbotCommand')

/**
 * Processa mensagem de texto do usuário e responde com chatbot IA.
 *
 * @param {import('node-telegram-bot-api')} bot
 * @param {import('node-telegram-bot-api').Message} msg
 */
export async function handleChatbotMessage(bot, msg) {
  const chatId = msg.chat.id
  const message = msg.text?.trim()

  // Ignorar mensagens vazias ou comandos (tratados por outros handlers)
  if (!message || message.startsWith('/')) return

  // Verificar API key antes de processar
  if (!process.env.GROQ_API_KEY) {
    logger.warn('GROQ_API_KEY nao configurada — chatbot desabilitado')
    return
  }

  let userId
  try {
    userId = await getUserIdByChatId(chatId)
  } catch (err) {
    // Usuário não vinculado: ignorar silenciosamente (sem mensagem de erro)
    // (o /start vai orientá-los a vincular a conta)
    logger.warn('Mensagem de chat ignorada — usuário não vinculado', err, { chatId })
    return
  }

  try {
    // Mostrar indicador de digitação enquanto processa
    await bot.sendChatAction(chatId, 'typing')

    const result = await sendTelegramChatMessage({ message, userId })

    await bot.sendMessage(chatId, result.response)
  } catch (error) {
    logger.error('Erro no handler do chatbot', error, { chatId })
    await bot.sendMessage(chatId, '🤖 Desculpe, tive um problema. Tente novamente.')
  }
}
