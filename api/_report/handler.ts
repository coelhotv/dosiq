/**
 * Handler do relatório clínico em PDF (spec 097 A2, D-A2-2; PO-SEC-6).
 *
 * Regras (vinculantes):
 * - Dados lidos com o JWT de QUEM CHAMA (chave anon + `Authorization`): a RLS do próprio usuário vale.
 *   Nunca service role.
 * - `GET ?warm=1` só sobe o Chromium (pré-aquecimento ao abrir a tela): sem auth, sem I/O de dado.
 * - Mesmo coletor/montador/template do `@dosiq/core` que o resto do app — nada é calculado aqui.
 * - Nada é guardado. Erro responde e loga só o código da etapa (PO-SEC-5), nunca conteúdo.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  buildReportModel,
  REPORT_PERIOD_DAYS,
  renderReportFooter,
  renderReportHtml,
  reportFileBaseName,
  type ReportInputs,
  type ReportPeriodDays,
} from '@dosiq/core/services/report'
import type { RateLimiter } from './rateLimit.js'

type ReportClient = { auth: { getUser: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> } }

export interface ReportHandlerDeps {
  supabaseUrl: string
  anonKey: string
  createClient: (url: string, key: string, options: { global: { headers: { Authorization: string } }; auth: { persistSession: false } }) => unknown
  /** Coleta com o client do usuário (default: `createReportCollector` do core). */
  collect: (client: unknown, args: { days: ReportPeriodDays; to: string }, getUserId: () => Promise<string>) => Promise<ReportInputs>
  renderPdf: (html: string, footer: string) => Promise<Uint8Array>
  warmUp: () => Promise<void>
  rateLimiter: RateLimiter
  now: () => Date
}

type Stage = 'collect' | 'render'

/** `to` (dia local do aparelho) não pode fugir mais de 1 dia do dia UTC do servidor. */
function isPlausibleToday(to: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return false
  const t = Date.parse(`${to}T12:00:00Z`)
  if (Number.isNaN(t)) return false
  return Math.abs(t - now.getTime()) <= 36 * 3_600_000
}

function parseBody(body: unknown, now: Date): { days: ReportPeriodDays; to: string } | null {
  if (!body || typeof body !== 'object') return null
  const { days, to } = body as { days?: unknown; to?: unknown }
  if (typeof days !== 'number' || !(REPORT_PERIOD_DAYS as readonly number[]).includes(days)) return null
  if (typeof to !== 'string' || !isPlausibleToday(to, now)) return null
  return { days: days as ReportPeriodDays, to }
}

export function createReportHandler(deps: ReportHandlerDeps) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET' && req.query?.warm) {
      try {
        await deps.warmUp()
      } catch {
        // Aquecimento é otimização: falhar aqui não pode virar erro na tela.
      }
      return res.status(204).end()
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

    const auth = req.headers?.authorization
    const jwt = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    if (!jwt) return res.status(401).json({ error: 'unauthorized' })

    const args = parseBody(req.body, deps.now())
    if (!args) return res.status(400).json({ error: 'invalid_body' })

    const client = deps.createClient(deps.supabaseUrl, deps.anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    }) as ReportClient
    const { data, error } = await client.auth.getUser(jwt)
    const userId = data?.user?.id
    if (error || !userId) return res.status(401).json({ error: 'unauthorized' })

    if (!deps.rateLimiter.take(userId)) return res.status(429).json({ error: 'too_many_requests' })

    let stage: Stage = 'collect'
    try {
      const inputs = await deps.collect(client, args, async () => userId)
      stage = 'render'
      const model = buildReportModel(inputs, { generatedAt: deps.now().toISOString() })
      const pdf = await deps.renderPdf(renderReportHtml(model), renderReportFooter(model))
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${reportFileBaseName(model.header.window)}.pdf"`)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).send(Buffer.from(pdf))
    } catch {
      console.error('[report] falha na etapa', stage)
      return res.status(500).json({ error: 'report_failed', error_code: stage })
    }
  }
}
