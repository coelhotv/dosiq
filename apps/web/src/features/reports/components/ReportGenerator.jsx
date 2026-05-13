/**
 * @fileoverview Componente de geração do resumo clínico em PDF.
 * Usa o pipeline dedicado do Modo Consulta Médica para todos os entrypoints.
 * @module features/reports/components/ReportGenerator
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { supabase } from '@shared/utils/supabase'
import { cachedAdherenceService } from '@shared/services/cachedServices'
import { getConsultationData } from '@features/consultation/services/consultationDataService'
import { generateConsultationPDF } from '@/features/reports/services/consultationPdfService.js'
import { shareReport, shareNative, copyToClipboard } from '@/features/reports/services/shareService'
import { analyticsService } from '@dashboard/services/analyticsService'
import Button from '@shared/components/ui/Button'
import { getNow, formatLocalDate } from '@utils/dateUtils.js'
import './ReportGenerator.css'

/**
 * Opções de período para o relatório.
 * @constant {Array<{value: string, label: string}>}
 */
const PERIOD_OPTIONS = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo o período' },
]

/** Renderiza o hero/header do gerador de relatórios. */
function ReportHero() {
  return (
    <div className="report-generator__hero">
      <div className="report-generator__hero-copy">
        <p className="report-generator__eyebrow">PDF clínico</p>
        <div className="report-generator__header">
          <h3 className="report-generator__title">Gerar Resumo Clínico</h3>
        </div>
        <p className="report-generator__description">
          Um PDF único, legível em consulta e pronto para compartilhar com o médico.
        </p>
      </div>
      <div className="report-generator__hero-badge">
        <span>Resumo</span>
        <strong>Clínico</strong>
      </div>
    </div>
  )
}

/** Renderiza o painel de informações do conteúdo incluído no PDF. */
function ReportContentPanel() {
  return (
    <section className="report-generator__panel report-generator__panel--soft">
      <label className="report-generator__label">Inclui no PDF</label>
      <div className="report-generator__chips">
        <span className="report-generator__chip">Tratamentos</span>
        <span className="report-generator__chip">Adesão</span>
        <span className="report-generator__chip">Estoque</span>
        <span className="report-generator__chip">Prescrições</span>
        <span className="report-generator__chip">Titulação</span>
      </div>
      <p className="report-generator__helper">
        O relatório clínico prioriza leitura rápida, com blocos curtos e gráficos legíveis.
      </p>
    </section>
  )
}

/** Renderiza as ações após PDF gerado com sucesso. */
function ReportSuccessActions({ isGenerating, shareLoading, onDownload, onShare, onRegenerate }) {
  return (
    <div className="report-generator__success">
      <div className="report-generator__success-message">Resumo clínico gerado com sucesso!</div>
      <div className="report-generator__success-actions">
        <Button className="report-generator__button report-generator__button--download" onClick={onDownload} variant="primary">
          Baixar PDF
        </Button>
        <Button className="report-generator__button report-generator__button--share" onClick={onShare} disabled={shareLoading} variant="secondary">
          {shareLoading ? <><span className="report-generator__spinner" />Enviando...</> : 'Compartilhar'}
        </Button>
        <Button className="report-generator__button report-generator__button--regenerate" onClick={onRegenerate} disabled={isGenerating} variant="outline">
          {isGenerating ? <><span className="report-generator__spinner" />Gerando...</> : 'Gerar Novo'}
        </Button>
      </div>
    </div>
  )
}

/** Período em dias para o mapa de períodos. */
const PERIOD_DAYS_MAP = { '7d': 7, '30d': 30, '90d': 90, all: 90 }

/** Resolve a aderência diária de acordo com o período selecionado. */
async function resolveAdherence(period, dailyAdherence) {
  const days = PERIOD_DAYS_MAP[period] || 30
  if (days <= 7) return dailyAdherence || []
  return cachedAdherenceService.getDailyAdherenceFromView(days)
}

/** Executa o compartilhamento nativo em mobile se disponível. */
async function tryNativeShare(url) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  if (!isMobile) return
  try {
    await shareNative(url, 'Resumo Clínico de Consulta')
  } catch {
    // Fallback silencioso - usuário verá o link copiável
  }
}

/** Renderiza o painel de seleção de período do relatório. */
function PeriodPanel({ period, isGenerating, onPeriodChange }) {
  return (
    <section className="report-generator__panel">
      <label className="report-generator__label" htmlFor="report-period">Período</label>
      <select
        id="report-period"
        className="report-generator__select"
        value={period}
        onChange={(e) => onPeriodChange(e.target.value)}
        disabled={isGenerating}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <p className="report-generator__helper">
        O intervalo define a janela de adesão exibida no resumo principal.
      </p>
    </section>
  )
}

/** Renderiza a área de link de compartilhamento copiável. */
function ShareResultSection({ shareUrl, shareLoading, copied, onCopyLink }) {
  if (!shareUrl || shareLoading) return null
  return (
    <div className="report-generator__share-result">
      <div className="report-generator__share-url-container">
        <input
          type="text"
          className="report-generator__share-url-input"
          value={shareUrl}
          readOnly
          aria-label="Link de compartilhamento"
        />
        <Button
          className="report-generator__copy-button"
          onClick={onCopyLink}
          variant={copied ? 'success' : 'secondary'}
          size="small"
        >
          {copied ? 'Copiado!' : 'Copiar'}
        </Button>
      </div>
      <p className="report-generator__share-expiry">Link válido por 72 horas</p>
    </div>
  )
}

function getPeriodLabel(selectedPeriod) {
  return PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)?.label || selectedPeriod
}

function buildConsultationReportFilename(selectedPeriod) {
  const periodLabel = getPeriodLabel(selectedPeriod)
  return `dosiq-consulta-medica-${periodLabel.replace(/\s+/g, '-')}-${formatDateForFilename()}.pdf`
}

/**
 * Formata a data atual para o nome do arquivo.
 * @returns {string} Data formatada como YYYY-MM-DD.
 */
function formatDateForFilename() {
  return formatLocalDate(getNow())
}

/**
 * Dispara o download de um Blob como arquivo.
 * @param {Blob} blob - Blob a ser baixado.
 * @param {string} filename - Nome do arquivo.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Componente de geração de relatórios PDF.
 *
 * @param {Object} props - Propriedades do componente.
 * @returns {JSX.Element} Componente de geração de relatórios.
 *
 * @example
 * // Uso básico
 * <ReportGenerator />
 *
 * // Com callback de fechamento
 * <ReportGenerator onClose={() => setIsModalOpen(false)} />
 */
export default function ReportGenerator() {
  // 1. States (R-010: Hook order)
  const [patientName, setPatientName] = useState('')
  const [patientEmail, setPatientEmail] = useState('')
  const [patientUserId, setPatientUserId] = useState(null)
  const [period, setPeriod] = useState('30d')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [pdfBlob, setPdfBlob] = useState(null)

  // Estados para compartilhamento
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [shareError, setShareError] = useState(null)
  const [copied, setCopied] = useState(false)

  const { medicines, protocols, logs, stockSummary, stats, dailyAdherence } = useDashboard()

  const dashboardData = useMemo(
    () => ({
      medicines,
      protocols,
      logs,
      stockSummary,
      stats,
      dailyAdherence,
    }),
    [medicines, protocols, logs, stockSummary, stats, dailyAdherence]
  )

  const consultationData = useMemo(
    () => getConsultationData(dashboardData, patientName, null, patientEmail, patientUserId),
    [dashboardData, patientEmail, patientName, patientUserId]
  )

  useEffect(() => {
    let isMounted = true

    const loadPatientProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!isMounted) return
        setPatientName(user?.user_metadata?.name || user?.user_metadata?.full_name || '')
        setPatientEmail(user?.email || '')
        setPatientUserId(user?.id || null)
      } catch (err) {
        console.error('Erro ao carregar perfil para relatório clínico:', err)
      }
    }

    loadPatientProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true); setError(null); setPdfBlob(null); setShareUrl(null); setShareError(null)
    try {
      const resolvedDailyAdherence = await resolveAdherence(period, dailyAdherence)
      const blob = await generateConsultationPDF({
        consultationData, dashboardData: { ...dashboardData, dailyAdherence: resolvedDailyAdherence }, period, title: 'Dosiq - Consulta Médica',
      })
      setPdfBlob(blob)
      analyticsService.track('report_generated', { period, fileSize: blob.size, fileType: 'pdf', reportType: 'consultation_clinical_pdf' })
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      setError('Erro ao gerar relatório. Tente novamente.')
      analyticsService.track('report_generation_error', { period, error: err.message })
    } finally {
      setIsGenerating(false)
    }
  }, [consultationData, dailyAdherence, dashboardData, period])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const filename = buildConsultationReportFilename(period)
    downloadBlob(pdfBlob, filename)
    analyticsService.track('report_downloaded', { period, filename, fileSize: pdfBlob.size, reportType: 'consultation_clinical_pdf' })
  }, [pdfBlob, period])

  const handleShare = useCallback(async () => {
    if (!pdfBlob) return
    setShareLoading(true); setShareError(null); setShareUrl(null); setCopied(false)
    try {
      const filename = buildConsultationReportFilename(period)
      const result = await shareReport(pdfBlob, { filename, expiresInHours: 72 })
      setShareUrl(result.url)
      await tryNativeShare(result.url)
      analyticsService.track('report_shared', { period, filename, expiresInHours: 72, reportType: 'consultation_clinical_pdf' })
    } catch (err) {
      console.error('Erro ao compartilhar relatório:', err)
      setShareError(err.message || 'Erro ao compartilhar relatório. Tente novamente.')
      analyticsService.track('report_share_error', { period, error: err.message })
    } finally {
      setShareLoading(false)
    }
  }, [pdfBlob, period])

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return
    try {
      await copyToClipboard(shareUrl)
      setCopied(true)
      analyticsService.track('report_share_link_copied', { period })
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('Erro ao copiar link:', err)
      setShareError('Não foi possível copiar o link. Copie manualmente.')
    }
  }, [shareUrl, period])

  return (
    <div className="report-generator">
      <ReportHero />

      <div className="report-generator__content">
        <PeriodPanel period={period} isGenerating={isGenerating} onPeriodChange={setPeriod} />
        <ReportContentPanel />
      </div>

      {error && <div className="report-generator__error" role="alert">{error}</div>}
      {shareError && <div className="report-generator__error" role="alert">{shareError}</div>}

      <div className="report-generator__actions">
        {!pdfBlob ? (
          <Button
            className="report-generator__button report-generator__button--generate"
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="primary"
          >
            {isGenerating ? <><span className="report-generator__spinner" />Gerando...</> : 'Gerar PDF Clínico'}
          </Button>
        ) : (
          <ReportSuccessActions
            isGenerating={isGenerating}
            shareLoading={shareLoading}
            onDownload={handleDownload}
            onShare={handleShare}
            onRegenerate={handleGenerate}
          />
        )}
      </div>

      <ShareResultSection shareUrl={shareUrl} shareLoading={shareLoading} copied={copied} onCopyLink={handleCopyLink} />

      {isGenerating && (
        <div className="report-generator__loading">
          <div className="report-generator__loading-bar">
            <div className="report-generator__loading-progress" />
          </div>
          <p className="report-generator__loading-text">Preparando seu relatório, aguarde...</p>
        </div>
      )}
    </div>
  )
}
