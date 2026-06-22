// api/chatbot.js — Vercel serverless function para Groq API
// SLOT: 2/12

import Groq from 'groq-sdk'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import {
  CHATBOT_MAX_TOKENS,
  CHATBOT_TEMPERATURE,
  CHATBOT_TOP_P,
  CHATBOT_MAX_HISTORY,
  CHATBOT_RATE_LIMIT_MAX,
  CHATBOT_RATE_LIMIT_WINDOW,
  CHATBOT_BLOCKED_PATTERNS,
  buildSystemPrompt,
} from '../apps/web/src/features/chatbot/config/chatbotConfig.js'
import { getServerTimestamp } from '@dosiq/core/utils'

// Modelo instruct fixo (sem web search — alinha com o grounding clínico).
// Override via env GROQ_MODEL na Vercel p/ A/B (ex.: openai/gpt-oss-120b como secundário).
const MODEL = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'

// Env Supabase (fallback VITE_ — R-090). Usado só para validar o JWT do usuário.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Rate limit server-side por usuário — best-effort em memória (mesmo padrão de
// api/users/_handlers/beta-signup.js). Reseta em cold start / por instância;
// combinado com a auth (atribuível por usuário) já barra o abuso anônimo da quota Groq.
const RATE_MAX = CHATBOT_RATE_LIMIT_MAX
const RATE_WINDOW_MS = CHATBOT_RATE_LIMIT_WINDOW
const rateHits = new Map()

function rateLimited(key) {
  const now = Date.now()
  const entry = rateHits.get(key)
  if (!entry || now > entry.resetAt) {
    rateHits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > RATE_MAX
}

// Guard server-side (defesa em profundidade — o cliente já filtra, mas um POST
// direto ignoraria o safetyGuard do front). Bloqueia intenções clínicas perigosas.
function isBlockedMessage(message) {
  return CHATBOT_BLOCKED_PATTERNS.some((pattern) => pattern.test(message))
}

function extractToken(req) {
  const authHeader = req.headers.authorization || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

// Cliente Supabase singleton (lazy) — evita recriar a cada request no serverless
// (overhead de CPU/conexão). Reusado entre invocações na mesma instância (Fluid).
let _supabase = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _supabase
}

async function verifyAuth(token) {
  if (!token) return { success: false }
  try {
    const { data, error } = await getSupabase().auth.getUser(token)
    if (error || !data.user) return { success: false }
    return { success: true, userId: data.user.id }
  } catch {
    return { success: false }
  }
}

const chatbotRequestSchema = z.object({
  message: z
    .string()
    .min(1, { message: 'Mensagem obrigatória' })
    .max(500, { message: 'Mensagem muito longa (max 500 caracteres)' }),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .optional()
    .default([]),
  // Apenas DADOS do paciente (sem PII/IDs). As REGRAS são compostas no servidor,
  // NUNCA recebidas do cliente (evita remoção das "REGRAS ABSOLUTAS").
  patientContext: z.string().max(4000).optional().default(''),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1. Auth obrigatória (Supabase JWT — R-042/AP-016)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[chatbot] Supabase env não configurada')
    return res.status(500).json({ error: 'Serviço indisponível' })
  }
  const auth = await verifyAuth(extractToken(req))
  if (!auth.success) {
    return res.status(401).json({ error: 'Não autorizado' })
  }

  // 2. Rate limit por usuário
  if (rateLimited(auth.userId)) {
    return res.status(429).json({
      error: 'Limite de mensagens atingido. Tente novamente mais tarde.',
    })
  }

  // 3. Validar API key Groq
  if (!process.env.GROQ_API_KEY) {
    console.error('[chatbot] GROQ_API_KEY nao configurada')
    return res.status(500).json({ error: 'Chatbot não configurado' })
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const parseResult = chatbotRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message })
    }

    const { message, history, patientContext } = parseResult.data

    // 4. Safety guard server-side (defesa em profundidade)
    if (isBlockedMessage(message)) {
      return res.status(422).json({
        error:
          'Não posso recomendar dosagens, diagnósticos ou mudanças no tratamento. Consulte seu médico.',
        blocked: true,
      })
    }

    // 5. System prompt composto NO SERVIDOR (regras autoritativas + contexto do cliente)
    const systemPrompt = buildSystemPrompt(patientContext)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-CHATBOT_MAX_HISTORY).map((h) => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ]

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: CHATBOT_MAX_TOKENS,
      temperature: CHATBOT_TEMPERATURE,
      top_p: CHATBOT_TOP_P,
    })

    const response =
      completion.choices[0]?.message?.content || 'Desculpe, não consegui responder.'

    // Log cache hit metrics (Groq Prompt Caching)
    const promptTokens = completion.usage?.prompt_tokens || 0
    const cachedTokens = completion.usage?.cached_prompt_tokens || 0
    const cacheHitRate = promptTokens > 0 ? Math.round((cachedTokens / promptTokens) * 100) : 0
    const estimatedSavings = Math.round(cachedTokens * 0.5) // 50% desconto em cached_tokens

    console.log(JSON.stringify({
      timestamp: getServerTimestamp(),
      service: 'chatbot-api',
      level: 'info',
      message: 'Groq response received',
      model: MODEL,
      promptTokens,
      cachedTokens,
      cacheHitRate: `${cacheHitRate}%`,
      estimatedTokenSavings: estimatedSavings,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    }))

    return res.status(200).json({
      response,
      model: MODEL,
      usage: completion.usage,
    })
  } catch (error) {
    console.error('[chatbot] Erro Groq:', error.message)

    if (error.status === 429) {
      return res.status(429).json({
        error: 'Limite de requisicoes atingido. Tente novamente em alguns segundos.',
      })
    }

    return res.status(500).json({ error: 'Erro ao processar mensagem' })
  }
}
