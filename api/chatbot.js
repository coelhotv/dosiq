// api/chatbot.js — Vercel serverless function para Groq API
// SLOT: 7/12 apos criacao

import Groq from 'groq-sdk'
import { z } from 'zod'

const MODEL = process.env.GROQ_MODEL || 'groq/compound'
const MAX_TOKENS = 300

const chatbotRequestSchema = z.object({
  message: z
    .string()
    .min(1, { message: 'Mensagem obrigatoria' })
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
    return res.status(500).json({ error: 'Chatbot nao configurado' })
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
      { role: 'system', content: systemPrompt || 'Voce e um assistente de medicamentos.' },
      ...history.slice(-10).map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ]

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      top_p: 0.9,
    })

    const response =
      completion.choices[0]?.message?.content || 'Desculpe, nao consegui responder.'

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
