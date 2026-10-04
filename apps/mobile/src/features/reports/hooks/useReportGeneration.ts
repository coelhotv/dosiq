/**
 * useReportGeneration — estado da tela do relatório (spec 097 Slice B, FR-009/FR-016, PO-12, PO-SEC-4).
 *
 * idle → loading → ready | error. Um toque só por vez (ref, não estado: dois toques no mesmo frame
 * enxergam o mesmo `status`). Erro mantém o período. O PDF anterior é apagado ao gerar outro, ao
 * trocar de período e ao desmontar — nunca durante o menu de compartilhar (o apagar espera o menu
 * fechar). Visualizar: iOS devolve a uri para o `DocumentViewer`; Android abre o app de PDF (B-1).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { DEFAULT_REPORT_PERIOD_DAYS, type ReportPeriodDays } from '@dosiq/core/services/report'
import {
  deleteReportFile,
  fetchReportPdf,
  openReportFile,
  ReportDownloadError,
  shareReportFile,
  warmReportEndpoint,
  type ReportDownloadErrorCode,
  type ReportPdf,
} from '../services/reportDownload'

export type ReportStatus = 'idle' | 'loading' | 'error' | 'ready'

const ERROR_MESSAGES: Record<ReportDownloadErrorCode, string> = {
  auth: 'Sua sessão expirou. Entre de novo para gerar o relatório.',
  rate_limited: 'Muitos relatórios em sequência. Aguarde um minuto e tente de novo.',
  network: 'Sem conexão com a internet. Confira a rede e tente de novo.',
  collect: 'Não foi possível gerar o relatório agora. Tente de novo.',
  render: 'Não foi possível gerar o relatório agora. Tente de novo.',
  share_unavailable: 'Compartilhamento não disponível neste aparelho.',
  share: 'Não foi possível abrir o compartilhamento. Tente de novo.',
  view_unavailable: 'Nenhum app para abrir PDF neste aparelho. Use "Compartilhar" para salvar o arquivo.',
  unknown: 'Não foi possível gerar o relatório agora. Tente de novo.',
}

export function reportErrorMessage(err: unknown): string {
  return ERROR_MESSAGES[err instanceof ReportDownloadError ? err.code : 'unknown']
}

export function useReportGeneration() {
  // 1. States (R-010)
  const [period, setPeriodState] = useState<ReportPeriodDays>(DEFAULT_REPORT_PERIOD_DAYS)
  const [status, setStatus] = useState<ReportStatus>('idle')
  const [report, setReport] = useState<ReportPdf | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Mensagem de Visualizar/Compartilhar: não derruba o estado de pronto.
  const [actionError, setActionError] = useState<string | null>(null)
  const [viewerUri, setViewerUri] = useState<string | null>(null)
  const inFlight = useRef(false)
  const sharing = useRef(false)
  const mounted = useRef(true)
  const currentUri = useRef<string | null>(null)

  // 3. Effects (R-010)
  useEffect(() => {
    mounted.current = true
    warmReportEndpoint()
    return () => {
      mounted.current = false
      // Sair da tela apaga o PDF (PO-SEC-4). Se o menu de compartilhar ainda estiver aberto, quem
      // apaga é o fim do share.
      if (!sharing.current) deleteReportFile(currentUri.current)
    }
  }, [])

  // 4. Handlers (R-010)
  const discardCurrent = useCallback(() => {
    deleteReportFile(currentUri.current)
    currentUri.current = null
    setReport(null)
    setViewerUri(null)
  }, [])

  const setPeriod = useCallback(
    (days: ReportPeriodDays) => {
      if (inFlight.current || sharing.current) return
      setPeriodState(days)
      if (currentUri.current) discardCurrent()
      setStatus('idle')
      setError(null)
      setActionError(null)
    },
    [discardCurrent]
  )

  const generate = useCallback(async () => {
    if (inFlight.current || sharing.current) return
    inFlight.current = true
    discardCurrent()
    setStatus('loading')
    setError(null)
    setActionError(null)
    try {
      const pdf = await fetchReportPdf(period)
      if (!mounted.current) {
        deleteReportFile(pdf.uri)
        return
      }
      currentUri.current = pdf.uri
      setReport(pdf)
      setStatus('ready')
    } catch (err) {
      if (!mounted.current) return
      setError(reportErrorMessage(err))
      setStatus('error')
    } finally {
      inFlight.current = false
    }
  }, [period, discardCurrent])

  const share = useCallback(async () => {
    const uri = currentUri.current
    if (!uri || sharing.current) return
    sharing.current = true
    setActionError(null)
    try {
      await shareReportFile(uri)
    } catch (err) {
      if (mounted.current) setActionError(reportErrorMessage(err))
    } finally {
      sharing.current = false
      // Tela fechada enquanto o menu estava aberto: o arquivo sai agora que o menu fechou.
      if (!mounted.current) deleteReportFile(uri)
    }
  }, [])

  const view = useCallback(async () => {
    const uri = currentUri.current
    if (!uri) return
    setActionError(null)
    if (Platform.OS !== 'android') {
      setViewerUri(uri)
      return
    }
    try {
      await openReportFile(uri)
    } catch (err) {
      if (mounted.current) setActionError(reportErrorMessage(err))
    }
  }, [])

  const closeViewer = useCallback(() => setViewerUri(null), [])

  return { period, setPeriod, status, report, error, actionError, viewerUri, generate, share, view, closeViewer }
}
