// chatbotService.js (mobile) — envia mensagem ao chatbot IA (spec 015 onda 2).
//
// Monta o contexto do paciente via @dosiq/core (fetcher + builder canônicos, paridade
// web↔Telegram↔mobile) e chama o serverless `api/chatbot.js` (mesma rota do PWA).
// SEGURANÇA (AP-237): systemPrompt + safetyGuard são compostos SERVER-SIDE; o cliente
// só envia `patientContext` (dados) + a mensagem. O endpoint exige JWT (401 sem token).

import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { nativeApiBaseUrl } from '../../../platform/config/nativePublicAppConfig'
import { fetchChatbotContextData, buildPatientContext } from '@dosiq/core'
import { CHATBOT_MAX_HISTORY } from '../config/chatbotConfig'

const CHATBOT_ENDPOINT = `${nativeApiBaseUrl}/api/chatbot`

/** Resolve o id do usuário autenticado (sessão Supabase nativa). */
async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id ?? null
}

/**
 * Busca + monta o contexto do paciente (fetcher + builder do core).
 * Cacheável por sessão de chat (fetch-on-open, FR-012) — quem chama decide reuso.
 * @returns {Promise<string>} patientContext (string compacta p/ o LLM)
 */
export async function buildMobilePatientContext() {
  const data = await fetchChatbotContextData({ supabase, getUserId })
  return buildPatientContext(data)
}

/**
 * Envia mensagem ao chatbot e retorna a resposta.
 * @param {Object} params
 * @param {string} params.message
 * @param {Array<{role,content}>} [params.history]
 * @param {string} params.patientContext - contexto já montado (cache de sessão)
 * @returns {Promise<{ response: string, error: boolean }>}
 */
export async function sendChatMessage({ message, history = [], patientContext }) {
  const { data } = await supabase.auth.getSession()
  const accessToken = data?.session?.access_token
  if (!accessToken) {
    return { response: 'Faça login para usar o assistente.', error: true }
  }

  try {
    const res = await fetch(CHATBOT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message,
        history: history.slice(-CHATBOT_MAX_HISTORY),
        patientContext,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `HTTP ${res.status}`)
    }

    const data = await res.json()
    return { response: data.response, error: false }
  } catch (error) {
    if (__DEV__) console.warn('[chatbot] erro ao enviar mensagem:', error?.message || error)
    return {
      response: 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.',
      error: true,
    }
  }
}
