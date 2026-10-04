/**
 * reportDownloadFlow — o ÚNICO caminho da web para o relatório clínico (spec 097 A2, D-A2-2).
 * Perfil e Modo Consulta chamam estas funções. O PDF é gerado no servidor (`POST /api/report`,
 * Chromium + template do core) com o JWT de quem chama; aqui só pedimos, baixamos e compartilhamos.
 *
 * Falha ⇒ `ReportFlowError` com código da etapa, nunca conteúdo (FR-022). Eventos passam pela
 * allowlist do core (PO-SEC-5).
 */
import {
  reportSizeBucket,
  toReportEventPayload,
  type ReportErrorCode,
  type ReportPeriodDays,
} from '@dosiq/core/services/report'
import { analyticsService } from '@dashboard/services/analyticsService'
import { supabase } from '@shared/utils/supabase'
import { formatLocalDate, getNow } from '@utils/dateUtils'

const ENDPOINT = '/api/report'

export type ReportFlowErrorCode = ReportErrorCode | 'rate_limited' | 'auth'

export class ReportFlowError extends Error {
  code: ReportFlowErrorCode
  constructor(code: ReportFlowErrorCode, cause?: unknown) {
    super(`Falha ao gerar relatório (${code})`)
    this.name = 'ReportFlowError'
    this.code = code
    this.cause = cause
  }
}

export interface ReportFile {
  file: File
  filename: string
}

/** Sobe o Chromium do servidor enquanto o usuário escolhe o período (sem dado, sem auth). */
export function warmReportEndpoint(): void {
  fetch(`${ENDPOINT}?warm=1`).catch(() => {
    // Aquecimento é otimização; falha aqui não aparece para o usuário.
  })
}

function filenameFrom(header: string | null, days: ReportPeriodDays, to: string): string {
  const match = header?.match(/filename="([^"]+)"/)
  return match?.[1] ?? `dosiq-relatorio-${days}d-${to}.pdf`
}

function codeForStatus(status: number): ReportFlowErrorCode {
  if (status === 401) return 'auth'
  if (status === 429) return 'rate_limited'
  return 'collect'
}

/** Pede o PDF de `days` dias terminando hoje (dia local). */
export async function fetchClinicalReport(days: ReportPeriodDays): Promise<ReportFile> {
  const started = getNow().getTime()
  const to = formatLocalDate(getNow())
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new ReportFlowError('auth')

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ days, to }),
    }).catch((err: unknown) => {
      throw new ReportFlowError('collect', err)
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error_code?: string } | null
      const serverCode = body?.error_code === 'render' ? 'render' : codeForStatus(res.status)
      throw new ReportFlowError(serverCode)
    }

    const blob = await res.blob()
    const filename = filenameFrom(res.headers.get('Content-Disposition'), days, to)
    analyticsService.track(
      'report_generated',
      toReportEventPayload({
        platform: 'web',
        period: days,
        duration_ms: getNow().getTime() - started,
        size_bucket: reportSizeBucket(blob.size),
      })
    )
    return { file: new File([blob], filename, { type: 'application/pdf' }), filename }
  } catch (err) {
    const code: ReportFlowErrorCode = err instanceof ReportFlowError ? err.code : 'unknown'
    const eventCode = code === 'rate_limited' || code === 'auth' ? 'collect' : code
    analyticsService.track('report_generation_error', toReportEventPayload({ platform: 'web', period: days, error_code: eventCode }))
    throw err instanceof ReportFlowError ? err : new ReportFlowError('unknown', err)
  }
}

/** Baixa o arquivo (desktop e celular). */
export function downloadReportFile({ file, filename }: ReportFile): void {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** O navegador consegue compartilhar ARQUIVO (menu nativo do celular)? */
export function canShareReportFile(report: ReportFile): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [report.file] })
}

/** Menu nativo de compartilhar com o arquivo. `false` = o usuário cancelou (não é erro). */
export async function shareReportFile(report: ReportFile): Promise<boolean> {
  try {
    await navigator.share({ files: [report.file], title: 'Relatório de acompanhamento' })
    return true
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return false
    throw new ReportFlowError('share', err)
  }
}
