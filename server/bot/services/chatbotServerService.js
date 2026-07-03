/**
 * Serviço de chatbot IA para o Telegram Bot (server-side).
 *
 * Equivalente server-side do chatbotService.js do cliente web.
 * Diferenças principais:
 * - Busca dados do paciente via Supabase diretamente (sem DashboardContext)
 * - Rate limiting via Map em memória (sem localStorage)
 * - Chama Groq SDK diretamente (sem fetch para /api/chatbot)
 * - Mantém histórico de conversa por userId em memória
 *
 * CONTEXTO DO PACIENTE (spec 015 onda 1a): o fetcher + builder são CANÔNICOS em
 * `@dosiq/core/chatbot` — fonte única web↔Telegram↔mobile. O antigo `buildServerContext` +
 * `fetchPatientData` (forks server-side) foram removidos; o Telegram passa a buscar via
 * `fetchChatbotContextData` (que inclui `doseInstances` + planos, antes ausentes aqui) e a
 * montar a string via `buildPatientContext`. Paridade por construção (mesmo input → mesma string).
 *
 * Configurações centralizadas em:
 * src/features/chatbot/config/chatbotConfig.js
 *
 * @module chatbotServerService
 */

import Groq from 'groq-sdk'
import { supabase } from '../../services/supabase.js'
import { createLogger } from '../logger.js'
import { getNow } from '../../utils/dateUtils'
import { fetchChatbotContextData, buildPatientContext } from '@dosiq/core'
import {
  CHATBOT_MAX_TOKENS,
  CHATBOT_TEMPERATURE,
  CHATBOT_TOP_P,
  CHATBOT_MAX_HISTORY,
  CHATBOT_RATE_LIMIT_MAX,
  CHATBOT_RATE_LIMIT_WINDOW,
  CHATBOT_BLOCKED_PATTERNS,
  CHATBOT_DISCLAIMER,
  CHATBOT_HEALTH_KEYWORDS,
} from '../../../apps/web/src/features/chatbot/config/chatbotConfig.js'

const logger = createLogger('ChatbotServerService')

// Modelo instruct fixo (sem web search — alinha com o grounding clínico).
// Override via env GROQ_MODEL p/ A/B (ex.: openai/gpt-oss-120b). Paridade com api/chatbot.js (web).
const MODEL = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'
const rateLimitMap = new Map()
const historyMap = new Map()

// -- Segurança --

/**
 * Valida mensagem do usuário antes de enviar ao LLM.
 * @param {string} message
 * @returns {{ blocked: boolean, reason?: string }}
 */
export function validateServerMessage(message) {
  for (const pattern of CHATBOT_BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason: 'Não posso recomendar dosagens, diagnósticos ou mudanças no tratamento. Consulte seu médico.',
      }
    }
  }

  if (!message || message.length > 500) {
    return {
      blocked: true,
      reason: 'Mensagem muito longa. Tente ser mais conciso (máx 500 caracteres).',
    }
  }

  return { blocked: false }
}

/**
 * Adiciona disclaimer médico à resposta do LLM se necessário.
 * @param {string} response
 * @returns {string}
 */
export function addServerDisclaimer(response) {
  const hasHealthContent = CHATBOT_HEALTH_KEYWORDS.some(kw => response.toLowerCase().includes(kw))

  if (hasHealthContent && !response.includes('Não substituo')) {
    return `${response}\n\n_${CHATBOT_DISCLAIMER}_`
  }

  return response
}

// -- Rate limiting --

/**
 * Verifica se o usuário atingiu o limite de mensagens.
 * @param {string} userId
 * @returns {boolean}
 */
export function isServerRateLimited(userId) {
  const data = rateLimitMap.get(userId)
  if (!data) return false
  const now = getNow().getTime()
  if (now - data.windowStart > CHATBOT_RATE_LIMIT_WINDOW) return false
  return data.count >= CHATBOT_RATE_LIMIT_MAX
}

function incrementServerRateCounter(userId) {
  const data = rateLimitMap.get(userId)
  const now = getNow().getTime()

  if (!data || now - data.windowStart > CHATBOT_RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { windowStart: now, count: 1 })
  } else {
    rateLimitMap.set(userId, { windowStart: data.windowStart, count: data.count + 1 })
  }
}

// -- Busca de dados do paciente (fetcher canônico do core) --

/**
 * Busca + monta o contexto do paciente via core (fetcher + builder canônicos).
 * Substitui os antigos fetchPatientData/buildServerContext (forks removidos na onda 1a).
 * @param {string} userId
 * @returns {Promise<{ context: string|null, error: string|null }>}
 */
async function _buildPatientContextForUser(userId) {
  try {
    logger.info('📊 Buscando contexto do paciente (core fetcher)', { userId })
    const data = await fetchChatbotContextData({
      supabase,
      getUserId: async () => userId,
    })
    const context = buildPatientContext(data)
    logger.info('✅ Contexto do paciente montado', {
      userId,
      medicinesCount: data.medicines?.length || 0,
      protocolsCount: data.protocols?.length || 0,
      doseInstancesCount: data.doseInstances?.length || 0,
      contextLen: context.length,
    })
    return { context, error: null }
  } catch (error) {
    logger.error('❌ Erro ao montar contexto do paciente', error, { userId })
    return {
      context: null,
      error: 'Desculpe, tive um problema ao carregar seus dados. Tente novamente.',
    }
  }
}

/**
 * Constrói a PARTE ESTÁTICA do system prompt (regras, instruções).
 * Esta seção é cacheable porque não muda entre requisições.
 * Ref: Groq Prompt Caching docs — colocar conteúdo estático PRIMEIRO.
 *
 * @returns {string}
 */
export function buildStaticSystemRules() {
  return [
    'Você é o assistente de saúde do app Dosiq no Telegram, focado em ajudar o paciente a seguir seus tratamentos e melhorar a adesão.',
    'Missão: responder com clareza "o que o paciente precisa fazer agora" — doses de hoje, adesão e estoque — com tom acolhedor e sem alarmismo, adequado a pessoas com condições crônicas e a idosos.',
    '',
    'O QUE VOCÊ PODE FAZER:',
    '- Informar as doses de hoje, a adesão e a situação de estoque a partir dos DADOS DO PACIENTE.',
    '- Explicar, em termos gerais e educativos, para que serve um medicamento e como ele age, usando o princípio ativo e a classe terapêutica do contexto somados ao conhecimento geral. Pode comparar genérico e medicamento de marca de forma geral.',
    '- Orientar de forma geral sobre organização e hábitos que melhoram a adesão.',
    '- Você NÃO registra doses: para registrar, oriente o paciente a usar o botão "Tomei" no app.',
    '',
    'COMO USAR AS INFORMAÇÕES (dois níveis):',
    '- FATOS DO PACIENTE (doses, horários, estoque, adesão, medicamentos em uso): use SOMENTE os DADOS DO PACIENTE abaixo. Se não estiverem lá, diga que não possui — NUNCA invente nomes, doses, horários, estoques ou números.',
    '- CONHECIMENTO GERAL (para que serve, como age, genérico vs marca): pode responder em nível educativo. Se não tiver certeza de um fato específico, oriente a confirmar com o farmacêutico ou o médico — não invente dados.',
    '',
    'REGRAS ABSOLUTAS (segurança):',
    '- NUNCA recomende, calcule ou ajuste dosagens; NUNCA sugira diagnósticos ou substituições de medicamentos.',
    '- NUNCA calcule nem sugira dose de insulina ou bolus, e NUNCA defina metas de glicemia — apenas relate o que o paciente registrou.',
    '- NUNCA sugira parar, iniciar ou alterar um tratamento sem consultar o médico.',
    '- Não personalize recomendações clínicas para o caso do paciente; mantenha-se no nível educativo geral.',
    '- Se a resposta mencionar medicamentos ou saúde, encerre com uma linha em branco seguida de: "Não substituo orientação médica."',
    '',
    'ESTILO:',
    '- Português brasileiro, claro e conciso (2 a 4 frases).',
    '- Responda em texto simples, sem Markdown (o Telegram usa formatação diferente).',
    '- Não suponha o que o paciente tomou se não estiver registrado nos dados.',
  ].join('\n')
}

/**
 * System prompt para o LLM (mesmo do contextBuilder.js web).
 * Combina regras estáticas (cacheable) + contexto dinâmico do paciente.
 *
 * NOTA: Para otimizar Groq Prompt Caching:
 * - Conteúdo estático (buildStaticSystemRules) deve vir PRIMEIRO
 * - Conteúdo dinâmico (patientContext) vem DEPOIS
 * - Isso permite cache hit em conversas multi-turn onde o contexto é reutilizado
 *
 * @param {string} patientContext
 * @returns {string}
 */
export function buildServerSystemPrompt(patientContext) {
  const staticRules = buildStaticSystemRules()
  return [
    staticRules,
    '',
    'DADOS DO PACIENTE:',
    patientContext,
  ].join('\n')
}

// -- Histórico de conversa --

/**
 * Obtém histórico de conversa de um usuário.
 * @param {string} userId
 * @returns {Array<{role: string, content: string}>}
 */
export function getConversationHistory(userId) {
  return historyMap.get(userId) || []
}

/**
 * Atualiza histórico de conversa de um usuário.
 * @param {string} userId
 * @param {string} userMessage
 * @param {string} assistantResponse
 */
export function updateConversationHistory(userId, userMessage, assistantResponse) {
  const history = historyMap.get(userId) || []
  const newHistory = [
    ...history,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantResponse },
  ].slice(-CHATBOT_MAX_HISTORY)
  historyMap.set(userId, newHistory)
}

// -- Função principal --

async function _callGroqApi(userId, messages) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    logger.info('🔵 Chamando Groq API', {
      userId,
      model: MODEL,
      messagesCount: messages.length,
      maxTokens: CHATBOT_MAX_TOKENS,
      temperature: CHATBOT_TEMPERATURE,
      topP: CHATBOT_TOP_P,
    })

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: CHATBOT_MAX_TOKENS,
      temperature: CHATBOT_TEMPERATURE,
      top_p: CHATBOT_TOP_P,
    })
    return { completion, error: null }
  } catch (error) {
    logger.error('❌ Erro ao chamar Groq API', error, {
      userId,
      errorStatus: error.status,
      errorMessage: error.message,
      errorType: error.constructor.name,
    })

    if (error.status === 429) {
      logger.warn('⚠️ Rate limit na Groq API', { userId })
      return {
        completion: null,
        error: '⏱️ Serviço de IA sobrecarregado. Tente novamente em alguns segundos.',
      }
    }

    return {
      completion: null,
      error: 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.',
    }
  }
}

function _checkPreconditions(message, userId) {
  const validation = validateServerMessage(message)
  if (validation.blocked) {
    logger.info('⛔ Mensagem bloqueada pela validação', { userId, reason: validation.reason })
    return { error: validation.reason, blocked: true, rateLimited: false }
  }

  if (isServerRateLimited(userId)) {
    logger.warn('⏱️ Rate limit atingido para usuário', { userId })
    return {
      error: '⏱️ Muitas perguntas! Aguarde alguns minutos e tente novamente.',
      blocked: false,
      rateLimited: true,
    }
  }

  if (!process.env.GROQ_API_KEY) {
    logger.error('❌ GROQ_API_KEY não configurada')
    return {
      error: '🤖 Assistente IA temporariamente indisponível.',
      blocked: false,
      rateLimited: false,
    }
  }

  return { error: null }
}

/**
 * Envia mensagem ao chatbot IA via Groq e retorna resposta.
 *
 * @param {Object} params
 * @param {string} params.message - Mensagem do usuário
 * @param {string} params.userId - UUID do usuário (para buscar dados e rate limit)
 * @returns {Promise<{
 *   response: string,
 *   blocked: boolean,
 *   reason?: string,
 *   rateLimited: boolean
 * }>}
 */
export async function sendTelegramChatMessage({ message, userId }) {
  logger.info('🤖 sendTelegramChatMessage entrada', {
    userId,
    msgLen: message.length,
    msgPreview: message.substring(0, 50),
  })

  const { error: preconditionError, blocked, rateLimited } = _checkPreconditions(message, userId)
  if (preconditionError) {
    return { response: preconditionError, blocked, rateLimited }
  }

  // 4. Buscar dados + montar contexto do paciente (fetcher + builder canônicos do core)
  const { context, error: contextError } = await _buildPatientContextForUser(userId)
  if (contextError) {
    return { response: contextError, blocked: false, rateLimited: false }
  }

  // 5. Regras estáticas + histórico (contexto do paciente entra mais tarde, ver passo 6)
  const staticRules = buildStaticSystemRules()
  const history = getConversationHistory(userId)
  logger.debug('✅ System prompt construído', {
    userId,
    contextLen: context.length,
    staticRulesLen: staticRules.length,
    historyLen: history.length,
  })

  // 6. Chamar Groq API — ordem otimizada p/ Prompt Caching (prefix-match), paridade com
  //    api/chatbot.js: system ESTÁTICO (cache global) → DADOS DO PACIENTE (estáveis na
  //    sessão, cacheados após o system) → histórico (cresce por turno) → pergunta.
  //    Paciente ANTES do histórico maximiza o prefixo estável (não muda a cada turno).
  const messages = [
    { role: 'system', content: staticRules },
    ...(context ? [{ role: 'system', content: `DADOS DO PACIENTE:\n${context}` }] : []),
    ...history,
    { role: 'user', content: message },
  ]
  const { completion, error: apiError } = await _callGroqApi(userId, messages)
  if (apiError) {
    return { response: apiError, blocked: false, rateLimited: false }
  }

  const rawResponse =
    completion.choices[0]?.message?.content || 'Desculpe, não consegui responder.'

  const promptTokens = completion.usage?.prompt_tokens || 0
  const cachedTokens = completion.usage?.cached_prompt_tokens || 0
  const cacheHitRate = promptTokens > 0 ? Math.round((cachedTokens / promptTokens) * 100) : 0
  const estimatedSavings = Math.round(cachedTokens * 0.5) // 50% desconto em cached_tokens

  logger.info('✅ Groq respondeu com sucesso', {
    userId,
    rawResponseLen: rawResponse.length,
    promptTokens,
    cachedTokens,
    cacheHitRate: `${cacheHitRate}%`,
    estimatedTokenSavings: estimatedSavings,
    completionTokens: completion.usage?.completion_tokens,
    totalTokens: completion.usage?.total_tokens,
  })

  // 7. Adicionar disclaimer se necessário
  const response = addServerDisclaimer(rawResponse)
  logger.debug('📝 Disclaimer adicionado (se necessário)', {
    userId,
    finalLen: response.length,
    disclaimerAdded: response.length > rawResponse.length,
  })

  // 8. Incrementar rate counter e atualizar histórico
  incrementServerRateCounter(userId)
  updateConversationHistory(userId, message, response)
  logger.info('✅ Taxa incrementada e histórico atualizado', { userId })

  logger.info('✅ Resposta final pronta para envio', {
    userId,
    finalResponseLen: response.length,
  })

  return { response, blocked: false, rateLimited: false }
}
