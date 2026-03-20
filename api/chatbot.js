// api/chatbot.js — Vercel serverless function para Groq API
// SLOT: 7/12 apos criacao

import Groq from 'groq-sdk'
import { z } from 'zod'
import {
  CHATBOT_MAX_TOKENS,
  CHATBOT_TEMPERATURE,
  CHATBOT_TOP_P,
  CHATBOT_MAX_HISTORY,
} from '../src/features/chatbot/config/chatbotConfig.js'

const MODEL = process.env.GROQ_MODEL || 'groq/compound'

const chatbotRequestSchema = z.object({
  message: z
    .string()
    .min(1, { message: 'Mensagem obrigatória' })
    .max(500, { message: 'Mensagem muito longa (max 500 caracteres)' }),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .optional()
    .default([]),
  systemPrompt: z.string().optional(),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validar API key
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

    const { message, history, systemPrompt } = parseResult.data

    // Montar mensagens para Groq
    const messages = [
      { role: 'system', content: systemPrompt || 'Você é um assistente de medicamentos.' },
      ...history.slice(-CHATBOT_MAX_HISTORY).map(h => ({
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
      timestamp: new Date().toISOString(),
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
