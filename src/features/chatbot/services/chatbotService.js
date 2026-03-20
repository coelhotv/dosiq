import { validateUserMessage, addDisclaimerIfNeeded } from './safetyGuard'
import { buildPatientContext, buildSystemPrompt } from './contextBuilder'
import {
  CHATBOT_MAX_HISTORY,
  CHATBOT_RATE_LIMIT_WINDOW,
  CHATBOT_RATE_LIMIT_MAX,
} from '../config/chatbotConfig'

const MAX_HISTORY = CHATBOT_MAX_HISTORY
const RATE_LIMIT_WINDOW = CHATBOT_RATE_LIMIT_WINDOW
const RATE_LIMIT_MAX = CHATBOT_RATE_LIMIT_MAX

/**
 * Envia mensagem ao chatbot e retorna resposta.
 *
 * @param {Object} params
 * @param {string} params.message - Mensagem do usuario
 * @param {Array} params.history - Historico de mensagens [{role, content}]
 * @param {Object} params.patientData - Dados do DashboardContext para contexto
 * @returns {Promise<{
 *   response: string,
 *   blocked: boolean,
 *   reason?: string,
 *   rateLimited: boolean
 * }>}
 */
export async function sendChatMessage({ message, history = [], patientData }) {
  // 1. Rate limiting (client-side)
  if (isRateLimited()) {
    return {
      response: '',
      blocked: false,
      rateLimited: true,
      reason: 'Limite de mensagens atingido. Tente novamente em alguns minutos.',
    }
  }

  // 2. Safety guard
  const validation = validateUserMessage(message)
  if (validation.blocked) {
    return {
      response: validation.reason,
      blocked: true,
      rateLimited: false,
    }
  }

  // 3. Build context
  const context = buildPatientContext(patientData)
  const systemPrompt = buildSystemPrompt(context)

  // 4. Enviar para serverless function
  try {
    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.slice(-MAX_HISTORY),
        systemPrompt,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const safeResponse = addDisclaimerIfNeeded(data.response)

    incrementRateCounter()

    return {
      response: safeResponse,
      blocked: false,
      rateLimited: false,
    }
  } catch (error) {
    console.error('[chatbot] Erro ao enviar mensagem:', error)
    return {
      response: 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.',
      blocked: false,
      rateLimited: false,
    }
  }
}

// -- Rate limiting (localStorage) --

function isRateLimited() {
  if (typeof window === 'undefined') return false
  try {
    const data = JSON.parse(localStorage.getItem('mr_chat_rate') || '{}')
    if (Date.now() - (data.windowStart || 0) > RATE_LIMIT_WINDOW) return false
    return (data.count || 0) >= RATE_LIMIT_MAX
  } catch {
    return false
  }
}

function incrementRateCounter() {
  if (typeof window === 'undefined') return
  try {
    const data = JSON.parse(localStorage.getItem('mr_chat_rate') || '{}')
    const now = Date.now()
    if (now - (data.windowStart || 0) > RATE_LIMIT_WINDOW) {
      localStorage.setItem('mr_chat_rate', JSON.stringify({ windowStart: now, count: 1 }))
    } else {
      localStorage.setItem(
        'mr_chat_rate',
        JSON.stringify({ windowStart: data.windowStart, count: (data.count || 0) + 1 })
      )
    }
  } catch {
    // Silently fail
  }
}
