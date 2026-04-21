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
import { generateConsultationPDF } from '../services/consultationPdfService.js'
import { shareReport, shareNative, copyToClipboard } from '../services/shareService'
import { analyticsService } from '@dashboard/services/analyticsService'
import Button from '@shared/components/ui/Button'
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
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

  const resolvePeriodDays = useCallback((selectedPeriod) => {
    const periodMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      all: 90,
    }

    return periodMap[selectedPeriod] || 30
  }, [])

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
    () => getConsultationData(dashboardData, patientName, null, patientEmail),
    [dashboardData, patientEmail, patientName]
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
      } catch (err) {
        console.error('Erro ao carregar perfil para relatório clínico:', err)
      }
    }

    loadPatientProfile()

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Handlers (R-010: States -> Memos -> Effects -> Handlers)
  /**
   * Manipula a geração do relatório PDF.
   * @async
   */
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    setPdfBlob(null)
    setShareUrl(null)
    setShareError(null)

    try {
      const periodDays = resolvePeriodDays(period)
      const resolvedDailyAdherence =
        periodDays <= 7
          ? dailyAdherence || []
          : await cachedAdherenceService.getDailyAdherenceFromView(periodDays)

      const blob = await generateConsultationPDF({
        consultationData,
        dashboardData: {
          ...dashboardData,
          dailyAdherence: resolvedDailyAdherence,
        },
        period,
        title: 'Dosiq - Consulta Médica',
      })
      setPdfBlob(blob)

      // Track analytics event
      analyticsService.track('report_generated', {
        period,
        fileSize: blob.size,
        fileType: 'pdf',
        reportType: 'consultation_clinical_pdf',
      })
    } catch (err) {
      console.error('Erro ao gerar relatório:', err)
      setError('Erro ao gerar relatório. Tente novamente.')
      analyticsService.track('report_generation_error', {
        period,
        error: err.message,
      })
    } finally {
      setIsGenerating(false)
    }
  }, [consultationData, dailyAdherence, dashboardData, period, resolvePeriodDays])

  /**
   * Manipula o download do PDF gerado.
   */
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return

    const filename = buildConsultationReportFilename(period)

    downloadBlob(pdfBlob, filename)

    analyticsService.track('report_downloaded', {
      period,
      filename,
      fileSize: pdfBlob.size,
      reportType: 'consultation_clinical_pdf',
    })
  }, [pdfBlob, period])

  /**
   * Manipula o compartilhamento do relatório.
   * @async
   */
  const handleShare = useCallback(async () => {
    if (!pdfBlob) return

    setShareLoading(true)
    setShareError(null)
    setShareUrl(null)
    setCopied(false)

    try {
      const filename = buildConsultationReportFilename(period)

      const result = await shareReport(pdfBlob, { filename, expiresInHours: 72 })
      setShareUrl(result.url)

      // Tentar compartilhamento nativo em dispositivos móveis
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
      if (isMobile) {
        try {
          await shareNative(result.url, 'Resumo Clínico de Consulta')
        } catch {
          // Fallback silencioso - usuário verá o link copiável
        }
      }

      analyticsService.track('report_shared', {
        period,
        filename,
        expiresInHours: 72,
        reportType: 'consultation_clinical_pdf',
      })
    } catch (err) {
      console.error('Erro ao compartilhar relatório:', err)
      setShareError(err.message || 'Erro ao compartilhar relatório. Tente novamente.')
      analyticsService.track('report_share_error', {
        period,
        error: err.message,
      })
    } finally {
      setShareLoading(false)
    }
  }, [pdfBlob, period])

  /**
   * Manipula a cópia do link para a área de transferência.
   * @async
   */
  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return

    try {
      await copyToClipboard(shareUrl)
      setCopied(true)

      analyticsService.track('report_share_link_copied', { period })

      // Resetar estado de copiado após 3 segundos
      setTimeout(() => setCopied(false), 3000)
    } catch (err) {
      console.error('Erro ao copiar link:', err)
      setShareError('Não foi possível copiar o link. Copie manualmente.')
    }
  }, [shareUrl, period])

  return (
    <div className="report-generator">
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

      <div className="report-generator__content">
        <section className="report-generator__panel">
          <label className="report-generator__label" htmlFor="report-period">
            Período
          </label>
          <select
            id="report-period"
            className="report-generator__select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            disabled={isGenerating}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="report-generator__helper">
            O intervalo define a janela de adesão exibida no resumo principal.
          </p>
        </section>

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
      </div>

      {error && (
        <div className="report-generator__error" role="alert">
          {error}
        </div>
      )}

      {shareError && (
        <div className="report-generator__error" role="alert">
          {shareError}
        </div>
      )}

      <div className="report-generator__actions">
        {!pdfBlob ? (
          <Button
            className="report-generator__button report-generator__button--generate"
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="primary"
          >
            {isGenerating ? (
              <>
                <span className="report-generator__spinner" />
                Gerando...
              </>
            ) : (
              'Gerar PDF Clínico'
            )}
          </Button>
        ) : (
          <div className="report-generator__success">
            <div className="report-generator__success-message">
              Resumo clínico gerado com sucesso!
            </div>
            <div className="report-generator__success-actions">
              <Button
                className="report-generator__button report-generator__button--download"
                onClick={handleDownload}
                variant="primary"
              >
                Baixar PDF
              </Button>
              <Button
                className="report-generator__button report-generator__button--share"
                onClick={handleShare}
                disabled={shareLoading}
                variant="secondary"
              >
                {shareLoading ? (
                  <>
                    <span className="report-generator__spinner" />
                    Enviando...
                  </>
                ) : (
                  'Compartilhar'
                )}
              </Button>
              <Button
                className="report-generator__button report-generator__button--regenerate"
                onClick={handleGenerate}
                disabled={isGenerating}
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <span className="report-generator__spinner" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Novo'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Seção de link de compartilhamento */}
      {shareUrl && !shareLoading && (
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
              onClick={handleCopyLink}
              variant={copied ? 'success' : 'secondary'}
              size="small"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
          <p className="report-generator__share-expiry">Link válido por 72 horas</p>
        </div>
      )}

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
