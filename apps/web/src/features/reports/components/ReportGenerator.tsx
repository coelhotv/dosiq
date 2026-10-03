/**
 * @fileoverview Geração do relatório clínico (spec 097 A2).
 * O PDF é gerado no servidor (`/api/report`, template único do `@dosiq/core`) e chega como arquivo:
 * baixar ou compartilhar (D-A2-2). Sem link público (FR-017). Fluxo carregado sob demanda (SC-003).
 * @module features/reports/components/ReportGenerator
 */

import { useState, useCallback, useEffect } from 'react'
import Button from '@shared/components/ui/Button'
import './ReportGenerator.css'

/** Períodos fixos, iguais na web e no mobile (RC2-D4); padrão 30. */
const PERIOD_OPTIONS = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
  { value: 180, label: 'Últimos 180 dias' },
] as const

type PeriodDays = (typeof PERIOD_OPTIONS)[number]['value']

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
          Um PDF para levar à consulta: baixe ou envie pelo WhatsApp.
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
        <span className="report-generator__chip">Tomadas</span>
        <span className="report-generator__chip">Mudanças</span>
        <span className="report-generator__chip">Titulação</span>
        <span className="report-generator__chip">Estoque</span>
      </div>
      <p className="report-generator__helper">
        Todos os números se referem ao período escolhido.
      </p>
    </section>
  )
}

/** Renderiza o painel de seleção de período do relatório. */
function PeriodPanel({ period, isGenerating, onPeriodChange }: { period: PeriodDays; isGenerating: boolean; onPeriodChange: (p: PeriodDays) => void }) {
  return (
    <section className="report-generator__panel">
      <label className="report-generator__label" htmlFor="report-period">Período</label>
      <select
        id="report-period"
        className="report-generator__select"
        value={period}
        onChange={(e) => onPeriodChange(Number(e.target.value) as PeriodDays)}
        disabled={isGenerating}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </section>
  )
}

/**
 * Componente de geração do relatório clínico.
 * @example
 * <ReportGenerator onClose={() => setIsModalOpen(false)} />
 */
type ReportFileT = import('@/features/reports/services/reportDownloadFlow').ReportFile

// Uma importação só por sessão: o aquecimento e o clique compartilham a mesma promessa.
let flowPromise: Promise<typeof import('@/features/reports/services/reportDownloadFlow')> | null = null
const loadFlow = () => (flowPromise ??= import('@/features/reports/services/reportDownloadFlow'))

/** Mensagem simples por código (nunca o detalhe técnico — FR-016). */
function errorMessage(code: string | undefined): string {
  if (code === 'rate_limited') return 'Muitos relatórios em sequência. Aguarde um minuto e tente de novo.'
  if (code === 'auth') return 'Sua sessão expirou. Entre de novo para gerar o relatório.'
  if (code === 'share') return 'Não foi possível abrir o compartilhamento. Use “Baixar PDF”.'
  return 'Não foi possível gerar o relatório. Confira a conexão e tente de novo.'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ReportGenerator(_props: { onClose?: () => void } = {}) {
  // 1. States (R-010: Hook order)
  const [period, setPeriod] = useState<PeriodDays>(30)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ReportFileT | null>(null)
  const [canShare, setCanShare] = useState(false)

  // 2. Effects — sobe o Chromium do servidor enquanto o usuário escolhe o período.
  useEffect(() => {
    loadFlow()
      .then((flow) => flow.warmReportEndpoint())
      .catch(() => {})
  }, [])

  // 3. Handlers
  const handleGenerate = useCallback(async () => {
    if (isGenerating) return
    setIsGenerating(true); setError(null); setReport(null)
    try {
      const flow = await loadFlow()
      const file = await flow.fetchClinicalReport(period)
      setReport(file)
      setCanShare(flow.canShareReportFile(file))
    } catch (err) {
      setError(errorMessage((err as { code?: string })?.code))
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating, period])

  const handleDownload = useCallback(async () => {
    if (!report) return
    const flow = await loadFlow()
    flow.downloadReportFile(report)
  }, [report])

  const handleShare = useCallback(async () => {
    if (!report) return
    try {
      const flow = await loadFlow()
      await flow.shareReportFile(report)
    } catch (err) {
      setError(errorMessage((err as { code?: string })?.code))
    }
  }, [report])

  const handlePeriodChange = useCallback((p: PeriodDays) => {
    setPeriod(p); setReport(null); setError(null)
  }, [])

  return (
    <div className="report-generator">
      <ReportHero />

      <div className="report-generator__content">
        <PeriodPanel period={period} isGenerating={isGenerating} onPeriodChange={handlePeriodChange} />
        <ReportContentPanel />
      </div>

      {error && <div className="report-generator__error" role="alert">{error}</div>}

      <div className="report-generator__actions">
        {report ? (
          <div className="report-generator__ready" role="status">
            <p className="report-generator__success-message">Relatório pronto.</p>
            <Button className="report-generator__button" onClick={handleDownload} variant="primary">Baixar PDF</Button>
            {canShare && (
              <Button className="report-generator__button" onClick={handleShare} variant="secondary">Compartilhar</Button>
            )}
            <Button className="report-generator__button" onClick={handleGenerate} disabled={isGenerating} variant="outline">Gerar de novo</Button>
          </div>
        ) : (
          <Button
            className="report-generator__button report-generator__button--generate"
            onClick={handleGenerate}
            disabled={isGenerating}
            variant="primary"
          >
            {isGenerating ? <><span className="report-generator__spinner" />Gerando...</> : error ? 'Tentar de novo' : 'Gerar PDF Clínico'}
          </Button>
        )}
      </div>

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
