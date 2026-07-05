import { validateUserMessage, addDisclaimerIfNeeded } from './safetyGuard'
import { buildPatientContext } from '@dosiq/core'
import { getNow } from '@utils/dateUtils'
import { supabase } from '@shared/utils/supabase'
import {
  CHATBOT_MAX_HISTORY,
  CHATBOT_RATE_LIMIT_WINDOW,
  CHATBOT_RATE_LIMIT_MAX,
  CHATBOT_HISTORY_STORAGE_KEY,
  CHATBOT_HISTORY_MAX_DISPLAY,
} from '@/features/chatbot/config/chatbotConfig'

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
      error: true, // transitório — não persiste no histórico
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

  // 3. Build context (apenas DADOS — as REGRAS são compostas no servidor, não confiáveis do cliente)
  const patientContext = buildPatientContext(patientData)

  // 4. Token de sessão — endpoint exige autenticação (sem token = 401, evita abuso anônimo da quota Groq)
  // Destructure defensivo: getSession() pode devolver data nulo sob falha de init do cliente (evita TypeError).
  const { data } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token
  if (!accessToken) {
    return {
      response: 'Faça login para usar o assistente.',
      blocked: false,
      rateLimited: false,
      error: true, // transitório — não persiste no histórico
    }
  }

  // 5. Enviar para serverless function
  try {
    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message,
        history: history.slice(-MAX_HISTORY),
        patientContext,
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
      error: false,
    }
  } catch (error) {
    console.error('[chatbot] Erro ao enviar mensagem:', error)
    return {
      response: 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.',
      blocked: false,
      rateLimited: false,
      error: true, // transitório — não persiste no histórico
    }
  }
}

// -- Rate limiting (localStorage) --

function isRateLimited() {
  if (typeof window === 'undefined') return false
  try {
    const data = JSON.parse(localStorage.getItem('mr_chat_rate') || '{}')
    if (getNow().getTime() - (data.windowStart || 0) > RATE_LIMIT_WINDOW) return false
    return (data.count || 0) >= RATE_LIMIT_MAX
  } catch {
    return false
  }
}

function incrementRateCounter() {
  if (typeof window === 'undefined') return
  try {
    const data = JSON.parse(localStorage.getItem('mr_chat_rate') || '{}')
    const now = getNow().getTime()
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

// -- Persistência de histórico (localStorage) --

/**
 * Carrega histórico persistido de conversa do localStorage.
 * @returns {Array<{role: string, content: string, timestamp: number}>}
 */
export function loadPersistedHistory() {
  if (typeof window === 'undefined') return []
  try {
    const data = JSON.parse(localStorage.getItem(CHATBOT_HISTORY_STORAGE_KEY) || '[]')
    // Validar estrutura mínima: array de objetos com role, content, timestamp
    if (!Array.isArray(data)) return []
    // !isError: ignora mensagens de erro transitórias eventualmente persistidas antes (robustez)
    return data.filter((msg) => msg.role && msg.content && typeof msg.timestamp === 'number' && !msg.isError)
  } catch {
    return []
  }
}

/**
 * Persiste histórico de conversa no localStorage.
 * Limita a CHATBOT_HISTORY_MAX_DISPLAY mensagens mais recentes.
 * @param {Array<{role: string, content: string, timestamp: number}>} messages
 */
export function savePersistedHistory(messages) {
  if (typeof window === 'undefined') return
  try {
    // Filtrar boas-vindas (1ª msg do assistente isolada) E mensagens de erro transitórias
    // (isError) — falhas de conexão/rate-limit não devem grudar no histórico persistido.
    const filtered = messages.filter((msg) => {
      if (msg.isError) return false
      if (msg.role === 'assistant' && messages.length === 1) return false // Mensagem inicial
      return true
    })
    // Manter apenas as últimas N mensagens
    const trimmed = filtered.slice(-CHATBOT_HISTORY_MAX_DISPLAY)
    localStorage.setItem(CHATBOT_HISTORY_STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Silently fail
  }
}

/**
 * Limpa histórico persistido do localStorage.
 */
export function clearPersistedHistory() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CHATBOT_HISTORY_STORAGE_KEY)
  } catch {
    // Silently fail
  }
}
