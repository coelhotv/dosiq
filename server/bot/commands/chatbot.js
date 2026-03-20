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

  // Log de entrada
  logger.info('📨 Mensagem de chat recebida', {
    chatId,
    msgPreview: message?.substring(0, 50) || '(vazio)',
    msgLen: message?.length || 0,
  })

  // Ignorar mensagens vazias ou comandos (tratados por outros handlers)
  if (!message || message.startsWith('/')) {
    logger.debug('⏭️ Ignorando (vazio ou comando)', { chatId })
    return
  }

  // Verificar API key antes de processar
  if (!process.env.GROQ_API_KEY) {
    logger.warn('❌ GROQ_API_KEY não configurada — chatbot desabilitado')
    return
  }

  let userId
  try {
    userId = await getUserIdByChatId(chatId)
    logger.info('✅ userId obtido', { chatId, userId })
  } catch (err) {
    // Usuário não vinculado: ignorar silenciosamente (sem mensagem de erro)
    // (o /start vai orientá-los a vincular a conta)
    logger.warn('❌ Usuário não vinculado', { chatId, error: err.message })
    return
  }

  try {
    // Mostrar indicador de digitação enquanto processa
    logger.debug('🕐 Enviando ação "typing" ao Telegram', { chatId })
    await bot.sendChatAction(chatId, 'typing')

    logger.debug('🤖 Chamando sendTelegramChatMessage', { chatId, userId, msgLen: message.length })
    const result = await sendTelegramChatMessage({ message, userId })

    logger.info('✅ Resultado do chatbot recebido', {
      chatId,
      userId,
      blocked: result.blocked,
      rateLimited: result.rateLimited,
      responseLen: result.response?.length || 0,
      responsePreview: result.response?.substring(0, 80) || '(vazio)',
    })

    logger.debug('📤 Enviando resposta ao Telegram', { chatId, respLen: result.response?.length })
    await bot.sendMessage(chatId, result.response)
    logger.info('✅ Mensagem enviada com sucesso', { chatId, respLen: result.response?.length })
  } catch (error) {
    logger.error('❌ Erro no handler do chatbot', error, { chatId, userId })
    try {
      await bot.sendMessage(chatId, '🤖 Desculpe, tive um problema. Tente novamente.')
    } catch (sendError) {
      logger.error('❌ Erro ao enviar mensagem de erro', sendError, { chatId })
    }
  }
}
