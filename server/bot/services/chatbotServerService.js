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
 * Configurações centralizadas em:
 * src/features/chatbot/config/chatbotConfig.js
 *
 * @module chatbotServerService
 */

import Groq from 'groq-sdk'
import { supabase } from '../../services/supabase.js'
import { createLogger } from '../logger.js'
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
} from '../../../src/features/chatbot/config/chatbotConfig.js'

const logger = createLogger('ChatbotServerService')

const MODEL = process.env.GROQ_MODEL || 'groq/compound'
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
  if (Date.now() - data.windowStart > CHATBOT_RATE_LIMIT_WINDOW) return false
  return data.count >= CHATBOT_RATE_LIMIT_MAX
}

function incrementServerRateCounter(userId) {
  const data = rateLimitMap.get(userId)
  const now = Date.now()

  if (!data || now - data.windowStart > CHATBOT_RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { windowStart: now, count: 1 })
  } else {
    rateLimitMap.set(userId, { windowStart: data.windowStart, count: data.count + 1 })
  }
}

// -- Busca de dados do paciente --

/**
 * Busca dados do paciente no Supabase para construção de contexto.
 * @param {string} userId
 * @returns {Promise<{ medicines, protocols, logs, stockSummary, stats }>}
 */
export async function fetchPatientData(userId) {
  logger.debug('📊 fetchPatientData: iniciando', { userId })

  const today = new Date()
  const yesterday = new Date(today.getTime() - 36 * 60 * 60 * 1000).toISOString()

  logger.debug('📅 Intervalo de tempo', {
    userId,
    today: today.toISOString(),
    yesterday,
  })

  logger.debug('🔄 Executando 4 queries em paralelo (Supabase)', { userId })

  const [medicinesResult, protocolsResult, logsResult, stockResult] = await Promise.all([
    supabase
      .from('medicines')
      .select('id, name, dosage_per_pill, dosage_unit, active_ingredient, therapeutic_class')
      .eq('user_id', userId),

    supabase
      .from('protocols')
      .select('id, medicine_id, frequency, time_schedule, dosage_per_intake')
      .eq('user_id', userId)
      .eq('active', true),

    supabase
      .from('medicine_logs')
      .select('protocol_id, taken_at')
      .eq('user_id', userId)
      .gte('taken_at', yesterday),

    supabase
      .from('stock')
      .select('medicine_id, quantity')
      .eq('user_id', userId)
      .gt('quantity', 0),
  ])

  logger.debug('✅ Queries Supabase completadas', {
    userId,
    medicinesCount: medicinesResult.data?.length || 0,
    medicinesError: medicinesResult.error?.message,
    protocolsCount: protocolsResult.data?.length || 0,
    protocolsError: protocolsResult.error?.message,
    logsCount: logsResult.data?.length || 0,
    logsError: logsResult.error?.message,
    stockCount: stockResult.data?.length || 0,
    stockError: stockResult.error?.message,
  })

  if (medicinesResult.error) {
    const { code, details, hint } = medicinesResult.error
    logger.error('❌ Erro ao buscar medicamentos', medicinesResult.error, {
      userId,
      errorCode: code,
      errorDetails: details,
      errorHint: hint,
    })
    throw medicinesResult.error
  }

  const timezone = 'America/Sao_Paulo'
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(today)

  // Filtrar logs de hoje (com timezone correto)
  const todayLogs = (logsResult.data || []).filter(log => {
    const logDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(log.taken_at))
    return logDate === todayLocal
  })

  // Agregar estoque por medicamento
  const stockByMedicine = {}
  for (const entry of (stockResult.data || [])) {
    stockByMedicine[entry.medicine_id] = (stockByMedicine[entry.medicine_id] || 0) + entry.quantity
  }

  const stockSummary = Object.entries(stockByMedicine).map(([medicine_id, quantity]) => ({
    medicine_id,
    quantity,
  }))

  // Calcular adesão simples dos últimos 7 dias
  const stats = await calculateSimpleAdherence(userId, protocolsResult.data || [])

  return {
    medicines: medicinesResult.data || [],
    protocols: protocolsResult.data || [],
    logs: todayLogs,
    stockSummary,
    stats,
  }
}

/**
 * Calcula adesão simples nos últimos 7 dias.
 * Versão simplificada sem protocolo completo.
 * @param {string} userId
 * @param {Array} protocols
 * @returns {Promise<{ adherence: number|null }>}
 */
async function calculateSimpleAdherence(userId, protocols) {
  if (!protocols.length) return { adherence: null }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: logs } = await supabase
    .from('medicine_logs')
    .select('id')
    .eq('user_id', userId)
    .gte('taken_at', sevenDaysAgo)

  // Estimativa simples: doses registradas / doses esperadas
  const totalDosesPerDay = protocols.reduce(
    (sum, p) => sum + (p.time_schedule?.length || 1),
    0
  )
  const expectedDoses = totalDosesPerDay * 7
  const actualDoses = logs?.length || 0

  return {
    adherence: expectedDoses > 0 ? Math.min(actualDoses / expectedDoses, 1) : null,
  }
}

// -- Construção de contexto (adaptado de contextBuilder.js) --

/**
 * Monta contexto compacto do paciente para o LLM.
 * Mesmo formato do contextBuilder.js do cliente web.
 * @param {{ medicines, protocols, logs, stockSummary, stats }} patientData
 * @returns {string}
 */
export function buildServerContext({ medicines, protocols, logs, stockSummary, stats }) {
  const today = new Date()
  const todayStr = today.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const medsContext = (medicines || []).map(med => {
    const protocol = (protocols || []).find(p => p.medicine_id === med.id)
    const stockEntry = (stockSummary || []).find(s => s.medicine_id === med.id)
    const totalStock = stockEntry?.quantity ?? 0

    return {
      nome: med.name,
      principioAtivo: med.active_ingredient,
      classeTerapeutica: med.therapeutic_class,
      dosagem: `${med.dosage_per_pill ?? ''}${med.dosage_unit ?? ''}`.trim(),
      frequencia: protocol?.frequency ?? 'sem protocolo',
      horarios: protocol?.time_schedule ?? [],
      estoque: totalStock,
    }
  })

  const adherence7d = stats?.adherence != null ? Math.round(stats.adherence * 100) : null

  return [
    `Data: ${todayStr}`,
    `Medicamentos ativos: ${medsContext.length}`,
    ...medsContext.map(m => {
      const infos = [m.principioAtivo, m.classeTerapeutica].filter(Boolean).join(', ')
      const detalhe = infos ? ` [${infos}]` : ''
      return `- ${m.nome}${detalhe} (${m.dosagem}): ${m.frequencia}, horarios ${m.horarios.join(', ') || 'nao definidos'}, estoque ${m.estoque} un.`
    }),
    `Doses registradas hoje: ${logs?.length ?? 0}`,
    adherence7d != null ? `Adesao ultimos 7 dias: ${adherence7d}%` : '',
  ]
    .filter(Boolean)
    .join('\n')
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
    'Você é um assistente virtual do app Meus Remedios no Telegram.',
    'Você ajuda o paciente a gerenciar seus medicamentos de forma amigavel.',
    'REGRAS ABSOLUTAS:',
    '- NUNCA recomende dosagens, diagnosticos ou substituicoes de medicamentos.',
    '- NUNCA sugira parar ou alterar tratamento sem consultar o medico.',
    '- Se sua resposta menciona medicamentos ou saúde, SEMPRE termine com uma linha em branco seguida de: "Não substituo orientação médica."',
    '- Responda em portugues brasileiro, de forma concisa (max 3 frases).',
    '- Responda em texto simples, sem Markdown (o Telegram usa formatacao diferente).',
    '- Use os dados do paciente abaixo para contextualizar respostas.',
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

  // 1. Validar mensagem
  logger.debug('🔍 Validando mensagem', { userId })
  const validation = validateServerMessage(message)
  if (validation.blocked) {
    logger.info('⛔ Mensagem bloqueada pela validação', {
      userId,
      reason: validation.reason,
    })
    return { response: validation.reason, blocked: true, rateLimited: false }
  }
  logger.debug('✅ Validação passou', { userId })

  // 2. Rate limiting
  if (isServerRateLimited(userId)) {
    logger.warn('⏱️ Rate limit atingido para usuário', { userId })
    return {
      response: '⏱️ Muitas perguntas! Aguarde alguns minutos e tente novamente.',
      blocked: false,
      rateLimited: true,
    }
  }
  logger.debug('✅ Rate limit OK', { userId })

  // 3. Verificar API key
  if (!process.env.GROQ_API_KEY) {
    logger.error('❌ GROQ_API_KEY não configurada')
    return {
      response: '🤖 Assistente IA temporariamente indisponível.',
      blocked: false,
      rateLimited: false,
    }
  }

  // 4. Buscar dados do paciente
  let patientData
  try {
    logger.info('📊 Buscando dados do paciente no Supabase', { userId })
    patientData = await fetchPatientData(userId)
    logger.info('✅ Dados do paciente obtidos com sucesso', {
      userId,
      medicinesCount: patientData.medicines?.length || 0,
      protocolsCount: patientData.protocols?.length || 0,
      logsCount: patientData.logs?.length || 0,
      stockCount: patientData.stockSummary?.length || 0,
      adherencePercent: patientData.stats?.adherence
        ? Math.round(patientData.stats.adherence * 100)
        : null,
    })
  } catch (error) {
    logger.error('❌ Erro ao buscar dados do paciente', error, { userId })
    return {
      response: 'Desculpe, tive um problema ao carregar seus dados. Tente novamente.',
      blocked: false,
      rateLimited: false,
    }
  }

  // 5. Construir contexto e system prompt
  logger.debug('🔨 Construindo contexto do paciente', { userId })
  const context = buildServerContext(patientData)
  const systemPrompt = buildServerSystemPrompt(context)
  const history = getConversationHistory(userId)
  logger.debug('✅ Contexto construído', {
    userId,
    contextLen: context.length,
    systemPromptLen: systemPrompt.length,
    historyLen: history.length,
  })

  // 6. Chamar Groq API
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ]

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
        response: '⏱️ Serviço de IA sobrecarregado. Tente novamente em alguns segundos.',
        blocked: false,
        rateLimited: false,
      }
    }

    return {
      response: 'Desculpe, estou com dificuldades técnicas. Tente novamente em instantes.',
      blocked: false,
      rateLimited: false,
    }
  }
}
