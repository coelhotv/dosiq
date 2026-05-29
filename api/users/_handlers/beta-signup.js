import { createClient } from '@supabase/supabase-js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_PLATFORMS = new Set(['android', 'ios', 'other'])

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5
const hits = new Map()

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

export async function handleBetaSignup(req, res) {
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

    // 23505 = unique_violation -> já cadastrado: tratamos como sucesso idempotente (evita enumeração de e-mails)
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
