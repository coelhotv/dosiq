/**
 * @fileoverview Componente de geração de relatórios PDF.
 * Permite ao usuário selecionar período e gerar/baixar/compartilhar relatórios.
 * @module features/reports/components/ReportGenerator
 */

import { useState, useCallback } from 'react'
import { generatePDF } from '../services/pdfGeneratorService.js'
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
 * @param {Function} [props.onClose] - Callback executado ao fechar o modal.
 * @returns {JSX.Element} Componente de geração de relatórios.
 *
 * @example
 * // Uso básico
 * <ReportGenerator />
 *
 * // Com callback de fechamento
 * <ReportGenerator onClose={() => setIsModalOpen(false)} />
 */
export default function ReportGenerator({ onClose }) {
  // 1. States (R-010: Hook order)
  const [period, setPeriod] = useState('30d')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [pdfBlob, setPdfBlob] = useState(null)

  // Estados para compartilhamento
  const [shareLoading, setShareLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState(null)
  const [shareError, setShareError] = useState(null)
  const [copied, setCopied] = useState(false)

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
      const blob = await generatePDF({ period })
      setPdfBlob(blob)

      // Track analytics event
      analyticsService.track('report_generated', {
        period,
        fileSize: blob.size,
        fileType: 'pdf',
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
  }, [period])

  /**
   * Manipula o download do PDF gerado.
   */
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return

    const periodLabel = PERIOD_OPTIONS.find((opt) => opt.value === period)?.label || period
    const filename = `meus-remedios-relatorio-${periodLabel.replace(/\s+/g, '-')}-${formatDateForFilename()}.pdf`

    downloadBlob(pdfBlob, filename)

    analyticsService.track('report_downloaded', {
      period,
      filename,
      fileSize: pdfBlob.size,
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
      const periodLabel = PERIOD_OPTIONS.find((opt) => opt.value === period)?.label || period
      const filename = `meus-remedios-relatorio-${periodLabel.replace(/\s+/g, '-')}-${formatDateForFilename()}.pdf`

      const result = await shareReport(pdfBlob, { filename, expiresInHours: 72 })
      setShareUrl(result.url)

      // Tentar compartilhamento nativo em dispositivos móveis
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      if (isMobile) {
        try {
          await shareNative(result.url, 'Relatório de Medicamentos')
        } catch {
          // Fallback silencioso - usuário verá o link copiável
        }
      }

      analyticsService.track('report_shared', {
        period,
        filename,
        expiresInHours: 72,
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

  /**
   * Manipula o fechamento do componente.
   */
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
    }
  }, [onClose])

  return (
    <div className="report-generator">
      <div className="report-generator__header">
        <h3 className="report-generator__title">Gerar Relatório</h3>
        {onClose && (
          <button
            className="report-generator__close"
            onClick={handleClose}
            aria-label="Fechar"
            type="button"
          >
            ✕
          </button>
        )}
      </div>

      <p className="report-generator__description">
        Gere um relatório completo em PDF com seu histórico de adesão, medicamentos e estoque.
      </p>

      <div className="report-generator__form">
        <label className="report-generator__label" htmlFor="report-period">
          Período do Relatório
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
      </div>

      {error && (
        <div className="report-generator__error" role="alert">
          <span className="report-generator__error-icon">⚠️</span>
          {error}
        </div>
      )}

      {shareError && (
        <div className="report-generator__error" role="alert">
          <span className="report-generator__error-icon">⚠️</span>
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
              <>
                <span className="report-generator__icon">📊</span>
                Gerar Relatório
              </>
            )}
          </Button>
        ) : (
          <div className="report-generator__success">
            <div className="report-generator__success-message">
              <span className="report-generator__success-icon">✅</span>
              Relatório gerado com sucesso!
            </div>
            <div className="report-generator__success-actions">
              <Button
                className="report-generator__button report-generator__button--download"
                onClick={handleDownload}
                variant="primary"
              >
                <span className="report-generator__icon">📥</span>
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
                  <>
                    <span className="report-generator__icon">🔗</span>
                    Compartilhar
                  </>
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
                  <>
                    <span className="report-generator__icon">🔄</span>
                    Gerar Novo
                  </>
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
              {copied ? (
                <>
                  <span className="report-generator__icon">✅</span>
                  Copiado!
                </>
              ) : (
                <>
                  <span className="report-generator__icon">📋</span>
                  Copiar
                </>
              )}
            </Button>
          </div>
          <p className="report-generator__share-expiry">
            <span className="report-generator__icon">⏰</span>
            Link válido por 72 horas
          </p>
        </div>
      )}

      {isGenerating && (
        <div className="report-generator__loading">
          <div className="report-generator__loading-bar">
            <div className="report-generator__loading-progress" />
          </div>
          <p className="report-generator__loading-text">
            Preparando seu relatório, aguarde...
          </p>
        </div>
      )}
    </div>
  )
}
