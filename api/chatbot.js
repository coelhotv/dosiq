// api/chatbot.js — Vercel serverless function para Groq API
// SLOT: 7/12 apos criacao

import Groq from 'groq-sdk'

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const MAX_TOKENS = 300

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
    const { message, history = [], systemPrompt } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem obrigatoria' })
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Mensagem muito longa (max 500 caracteres)' })
    }

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
