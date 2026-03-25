/**
 * Filtros de seguranca para mensagens do chatbot.
 * Bloqueia intencoes perigosas e adiciona disclaimer medico.
 */

import {
  CHATBOT_BLOCKED_PATTERNS,
  CHATBOT_DISCLAIMER,
  CHATBOT_HEALTH_KEYWORDS,
} from '../config/chatbotConfig'

export const DISCLAIMER = CHATBOT_DISCLAIMER

/**
 * Valida mensagem do usuario antes de enviar ao LLM.
 * @param {string} message
 * @returns {{ blocked: boolean, reason?: string }}
 */
export function validateUserMessage(message) {
  for (const pattern of CHATBOT_BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason:
          'Não posso recomendar dosagens, diagnósticos ou mudanças no tratamento. Consulte seu médico.',
      }
    }
  }

  if (message.length > 500) {
    return {
      blocked: true,
      reason: 'Mensagem muito longa. Tente ser mais conciso (máx 500 caracteres).',
    }
  }

  return { blocked: false }
}

/**
 * Adiciona disclaimer a resposta do LLM se necessario.
 * @param {string} response
 * @returns {string}
 */
export function addDisclaimerIfNeeded(response) {
  const hasHealthContent = CHATBOT_HEALTH_KEYWORDS.some((kw) => response.toLowerCase().includes(kw))

  if (hasHealthContent && !response.includes('Não substituo')) {
    return `${response}\n\n_${CHATBOT_DISCLAIMER}_`
  }

  return response
}
