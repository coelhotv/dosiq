/**
 * POST /api/report — relatório clínico em PDF (spec 097 A2, D-A2-2). GET ?warm=1 pré-aquece.
 * Função 7/12 (R-090). Lógica em `api/_report/` (fora da contagem).
 */
import { createClient } from '@supabase/supabase-js'
import { createReportCollector } from '@dosiq/core/services/report'
import { getRawNow } from '@dosiq/core/utils'
import { createReportHandler } from './_report/handler.js'
import { createRateLimiter } from './_report/rateLimit.js'
import { renderPdf, warmUp } from './_report/renderPdf.js'

// Fallback de env (api/CLAUDE.md). Chave ANON: os dados são lidos com o JWT de quem chama.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!supabaseUrl || !anonKey) throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY não configurada')

export default createReportHandler({
  supabaseUrl,
  anonKey,
  createClient: (url, key, options) => createClient(url, key, options),
  collect: (client, args, getUserId) =>
    createReportCollector({ client: client as Parameters<typeof createReportCollector>[0]['client'], getUserId }).collect(args),
  renderPdf,
  warmUp,
  rateLimiter: createRateLimiter({ max: 5, windowMs: 60_000 }),
  warmLimiter: createRateLimiter({ max: 10, windowMs: 60_000 }),
  // Instante UTC bruto: o dia local do usuário vem do corpo (`to`) e do fuso de user_settings.
  now: getRawNow,
})
