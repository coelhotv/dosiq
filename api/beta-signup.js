// api/beta-signup.js — captura de e-mail para o closed testing (Android).
// Escrita pública → roda no servidor com service_role (tabela beta_signups
// NÃO tem grant para anon). Valida e-mail, rate-limit leve por IP, idempotente
// (nunca revela se o e-mail já existe — evita enumeração).
import { createClient } from '@supabase/supabase-js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_PLATFORMS = new Set(['android', 'ios', 'other'])

// Rate-limit best-effort em memória (instância serverless é efêmera/reutilizável;
// suficiente p/ captura de beta — não é controle de segurança forte).
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5
const hits = new Map() // ip -> { count, resetAt }

function rateLimited(ip) {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > RATE_MAX
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em instantes.' })
  }

  try {
    const { email, platform = 'android' } = req.body || {}
    const normalized = String(email ?? '').trim().toLowerCase()

    if (!EMAIL_RE.test(normalized)) {
      return res.status(400).json({ error: 'E-mail inválido' })
    }
    const plat = ALLOWED_PLATFORMS.has(platform) ? platform : 'other'

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await supabase
      .from('beta_signups')
      .insert([{ email: normalized, platform: plat }])

    // 23505 = unique_violation → já cadastrado: tratamos como sucesso idempotente
    // (não revelar que o e-mail já existe na lista — evita enumeração).
    if (error && error.code !== '23505') {
      console.error('beta-signup insert error:', error)
      return res.status(500).json({ error: 'Não foi possível registrar agora. Tente mais tarde.' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('beta-signup error:', err)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
