// api/generate-doses.js — Cron dedicado do motor de geração de dose_instances (ADR-051).
//
// ISOLADO de api/notify.js de propósito: notificação de dose é crítica/prioritária.
// Aqui o motor tem seu próprio invoke e orçamento de 60s — um pico/timeout do motor
// NÃO afeta os reminders. Disparado por cron-job.org 1×/dia (~03:00 SP) com CRON_SECRET.
//
// Roda no servidor com service_role (ignora RLS) → acesso escopado por protocolo/usuário
// dentro do motor (R-042). Funções importadas de server/bot/doseInstanceScheduler.js.

import { generateDoseInstances, cleanupPausedProtocols } from '../server/bot/doseInstanceScheduler.js'
import { createLogger } from '../server/bot/logger.js'

const logger = createLogger('GenerateDosesCron')

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' })
  }

  // Auth: Bearer CRON_SECRET. Falha-fechado se o segredo não estiver configurado —
  // sem essa guarda, CRON_SECRET undefined viraria "Bearer undefined" e qualquer
  // requisição com esse header burlaria a autenticação (Gemini #604, security-high).
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Tentativa não autorizada de gerar dose_instances')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const startedAt = Date.now()
  try {
    const gen = await generateDoseInstances()
    const cleanup = await cleanupPausedProtocols()
    const durationMs = Date.now() - startedAt

    logger.info('Cron de geração concluído', { ...gen, ...cleanup, durationMs })
    return res.status(200).json({
      success: true,
      processed: gen.processed,
      generated: gen.generated,
      cleaned: cleanup.cleaned,
      durationMs,
    })
  } catch (err) {
    logger.error('Falha no cron de geração de dose_instances', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
