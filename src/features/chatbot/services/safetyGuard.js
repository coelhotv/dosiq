/**
 * Filtros de seguranca para mensagens do chatbot.
 * Bloqueia intencoes perigosas e adiciona disclaimer medico.
 */

const BLOCKED_PATTERNS = [
  /qual\s+(dosagem|dose)\s+(devo|posso|preciso)/i,
  /posso\s+(parar|interromper|suspender)\s+de\s+tomar/i,
  /substituir\s+.+\s+por/i,
  /diagnostico|diagnosticar/i,
  /receitar|prescrever/i,
  /efeito\s+colateral\s+grave/i,
]

export const DISCLAIMER =
  'Não substituo orientação médica. Consulte seu médico para decisões sobre o seu tratamento.'

/**
 * Valida mensagem do usuario antes de enviar ao LLM.
 * @param {string} message
 * @returns {{ blocked: boolean, reason?: string }}
 */
export function validateUserMessage(message) {
  for (const pattern of BLOCKED_PATTERNS) {
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
  const healthKeywords = ['medicamento', 'remedio', 'dose', 'tratamento', 'saude', 'sintoma']
  const hasHealthContent = healthKeywords.some(kw => response.toLowerCase().includes(kw))

  if (hasHealthContent && !response.includes('Não substituo')) {
    return `${response}\n\n_${DISCLAIMER}_`
  }

  return response
}
