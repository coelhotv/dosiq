/**
 * reportDownload — o ÚNICO caminho do mobile para o relatório clínico (spec 097 Slice B, B-mob1).
 * O PDF é gerado no servidor (`POST /api/report`, mesmo coletor/montador/template do core que a web)
 * com o JWT da sessão; aqui só pedimos, gravamos no cache, abrimos, compartilhamos e apagamos.
 *
 * Regras (vinculantes):
 * - Arquivo só em `Paths.cache`, com nome `dosiq-relatorio-<período>-<data>.pdf` (sem nome do
 *   paciente) e apagado pelo chamador ao sair/regerar (PO-SEC-4).
 * - Falha ⇒ `ReportDownloadError` com código da etapa, nunca conteúdo (FR-022).
 * - Eventos só pela allowlist do core (PO-SEC-5).
 */
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as IntentLauncher from 'expo-intent-launcher'
import { formatLocalDate, getNow } from '@dosiq/core'
import {
  reportSizeBucket,
  toReportEventPayload,
  type ReportErrorCode,
  type ReportPeriodDays,
} from '@dosiq/core/services/report'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { nativeApiBaseUrl } from '@platform/config/nativePublicAppConfig'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'

const ENDPOINT = `${nativeApiBaseUrl}/api/report`
const SAFE_FILENAME = /^dosiq-relatorio-[A-Za-z0-9-]+\.pdf$/
// Intent.FLAG_GRANT_READ_URI_PERMISSION — o app de PDF lê o arquivo pelo content uri.
const FLAG_GRANT_READ_URI_PERMISSION = 1

export type ReportDownloadErrorCode =
  | 'auth'
  | 'rate_limited'
  | 'network'
  | 'collect'
  | 'render'
  | 'share_unavailable'
  | 'share'
  | 'view_unavailable'
  | 'unknown'

export class ReportDownloadError extends Error {
  code: ReportDownloadErrorCode
  constructor(code: ReportDownloadErrorCode, cause?: unknown) {
    super(`Falha no relatório (${code})`)
    this.name = 'ReportDownloadError'
    this.code = code
    this.cause = cause
  }
}

export interface ReportPdf {
  uri: string
  filename: string
}

/** Código do evento: vocabulário fechado do core (auth/rede/limite são falha de coleta). */
function eventCodeOf(code: ReportDownloadErrorCode): ReportErrorCode {
  if (code === 'render') return 'render'
  if (code === 'share' || code === 'share_unavailable') return 'share'
  if (code === 'unknown') return 'unknown'
  return 'collect'
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}

/** Sobe o Chromium do servidor enquanto o usuário escolhe o período (sem dado). */
export function warmReportEndpoint(): void {
  accessToken()
    .then((token) => {
      if (token) return fetch(`${ENDPOINT}?warm=1`, { headers: { Authorization: `Bearer ${token}` } })
    })
    .catch(() => {
      // Aquecimento é otimização; falha aqui não aparece para o usuário.
    })
}

function filenameFrom(header: string | null, days: ReportPeriodDays, to: string): string {
  const name = header?.match(/filename="([^"]+)"/)?.[1]
  return name && SAFE_FILENAME.test(name) ? name : `dosiq-relatorio-${days}d-${to}.pdf`
}

function codeForStatus(status: number, serverCode: unknown): ReportDownloadErrorCode {
  if (status === 401) return 'auth'
  if (status === 429) return 'rate_limited'
  return serverCode === 'render' ? 'render' : 'collect'
}

/** Pede o PDF de `days` dias terminando hoje (dia local, R-020) e grava no cache. */
export async function fetchReportPdf(days: ReportPeriodDays): Promise<ReportPdf> {
  const started = Date.now()
  const to = formatLocalDate(getNow())
  try {
    const token = await accessToken()
    if (!token) throw new ReportDownloadError('auth')

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ days, to }),
    }).catch((err: unknown) => {
      throw new ReportDownloadError('network', err)
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error_code?: string } | null
      throw new ReportDownloadError(codeForStatus(res.status, body?.error_code))
    }

    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength === 0) throw new ReportDownloadError('render')

    const filename = filenameFrom(res.headers.get('Content-Disposition'), days, to)
    const file = new File(Paths.cache, filename)
    // overwrite:true — mesmo período no mesmo dia gera o mesmo nome (padrão do ExportSheet).
    file.create({ overwrite: true })
    file.write(bytes)

    void logEvent(
      EVENTS.REPORT_GENERATED,
      toReportEventPayload({
        platform: 'mobile',
        surface: SURFACES.MOBILE,
        period: days,
        duration_ms: Date.now() - started,
        size_bucket: reportSizeBucket(bytes.byteLength),
      })
    )
    return { uri: file.uri, filename }
  } catch (err) {
    const code: ReportDownloadErrorCode = err instanceof ReportDownloadError ? err.code : 'unknown'
    void logEvent(
      EVENTS.REPORT_GENERATION_ERROR,
      toReportEventPayload({ platform: 'mobile', surface: SURFACES.MOBILE, period: days, error_code: eventCodeOf(code) })
    )
    throw err instanceof ReportDownloadError ? err : new ReportDownloadError('unknown', err)
  }
}

/** Menu nativo de compartilhar. Resolve quando o menu fecha — só então o arquivo pode sair. */
export async function shareReportFile(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new ReportDownloadError('share_unavailable')
  try {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Relatório de acompanhamento',
    })
  } catch (err) {
    throw new ReportDownloadError('share', err)
  }
}

/**
 * Android: abre no visualizador de PDF do sistema (o WebView do Android não renderiza PDF — B-1).
 * iOS não passa por aqui: a tela abre o `DocumentViewer` com a uri.
 */
export async function openReportFile(uri: string): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: new File(uri).contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type: 'application/pdf',
    })
  } catch (err) {
    throw new ReportDownloadError('view_unavailable', err)
  }
}

/** Apaga o PDF do cache (PO-SEC-4). Idempotente: arquivo ausente não é erro. */
export function deleteReportFile(uri: string | null | undefined): void {
  if (!uri) return
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch {
    // Já apagado ou cache limpo pelo sistema: nada a fazer.
  }
}
