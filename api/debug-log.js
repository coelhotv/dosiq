// debug-log.js — endpoint temporário de debug mobile
// REMOVER antes do lançamento público ao App Store/Play Store
// Uso: POST /api/debug-log com { event, data }
// Logs visíveis em: Vercel Dashboard → dosiq → Functions → debug-log

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const { event, data } = req.body ?? {}
  if (!event) return res.status(400).json({ error: 'event required' })

  console.log('[mobile-debug]', JSON.stringify({ event, data: data ?? {}, ts: new Date().toISOString() }))

  return res.status(200).json({ ok: true })
}
