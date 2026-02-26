import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { getConsultationData } from '@features/consultation/services/consultationDataService'
import ConsultationView from '@features/consultation/components/ConsultationView'
import Loading from '@shared/components/ui/Loading'
import { analyticsService } from '@dashboard/services/analyticsService'
import pdfGeneratorService from '@features/reports/services/pdfGeneratorService'
import { shareService } from '@features/reports/services/shareService'

/**
 * Consultation - Container View do Modo Consulta Médica
 *
 * Integra o ConsultationView na navegação do app, fornecendo
 * os dados necessários e handlers para ações do usuário.
 *
 * @param {Object} props
 * @param {function} props.onBack - Callback para voltar ao dashboard
 */
export default function Consultation({ onBack }) {
  const [isLoading, setIsLoading] = useState(true)
  const [consultationData, setConsultationData] = useState(null)
  const [error, setError] = useState(null)

  // Obtém dados do contexto do Dashboard
  const {
    medicines,
    protocols,
    logs,
    stockSummary,
    stats,
  } = useDashboard()

  // Agrega dados para o Modo Consulta
  useEffect(() => {
    const loadConsultationData = () => {
      try {
        setIsLoading(true)
        setError(null)

        // Verifica se temos dados suficientes
        if (!medicines || !protocols) {
          setConsultationData(null)
          return
        }

        // Agrega dados usando o service
        const data = getConsultationData(
          { medicines, protocols, logs, stockSummary, stats },
          '', // patientName - pode ser expandido no futuro
          null // patientAge - pode ser expandido no futuro
        )

        setConsultationData(data)
      } catch (err) {
        console.error('Erro ao carregar dados de consulta:', err)
        setError('Não foi possível carregar os dados para consulta.')
      } finally {
        setIsLoading(false)
      }
    }

    loadConsultationData()
  }, [medicines, protocols, logs, stockSummary, stats])

  // Handler para gerar PDF
  const handleGeneratePDF = useCallback(async () => {
    try {
      analyticsService.track('consultation_pdf_generated', {
        timestamp: Date.now(),
      })

      // Gera relatório de consulta usando o serviço existente
      const pdfBlob = await pdfGeneratorService.generatePDF({
        period: 'last30days',
        includeCharts: true,
        includeTables: true,
      })

      // Download do PDF
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `consulta-medica-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Tente novamente.')
    }
  }, [])

  // Handler para compartilhar
  const handleShare = useCallback(async () => {
    try {
      analyticsService.track('consultation_share_initiated', {
        timestamp: Date.now(),
      })

      // Gera PDF para compartilhamento
      const pdfBlob = await pdfGeneratorService.generatePDF({
        period: 'last30days',
        includeCharts: true,
        includeTables: true,
      })

      // Tenta usar a Web Share API se disponível
      if (navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], 'consulta-medica.pdf', {
          type: 'application/pdf',
        })

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Dados da Consulta Médica',
            text: 'Relatório de tratamento e adesão aos medicamentos',
            files: [file],
          })

          analyticsService.track('consultation_shared', {
            method: 'web_share_api',
          })
          return
        }
      }

      // Fallback: upload e gera link
      const { url: shareUrl } = await shareService.shareReport(pdfBlob, { filename: 'consulta-medica.pdf' })

      // Copia link para clipboard
      await navigator.clipboard.writeText(shareUrl)
      alert('Link de compartilhamento copiado para a área de transferência!')

      analyticsService.track('consultation_shared', {
        method: 'link',
      })
    } catch (err) {
      console.error('Erro ao compartilhar:', err)

      if (err.name !== 'AbortError') {
        alert('Erro ao compartilhar. Tente novamente.')
      }
    }
  }, [])

  // Handler para voltar
  const handleBack = useCallback(() => {
    analyticsService.track('consultation_mode_closed', {
      timestamp: Date.now(),
    })
    onBack?.()
  }, [onBack])

  // Memoiza handlers para evitar re-renderizações desnecessárias
  const handlers = useMemo(() => ({
    onGeneratePDF: handleGeneratePDF,
    onShare: handleShare,
    onBack: handleBack,
  }), [handleGeneratePDF, handleShare, handleBack])

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: 'var(--space-4)',
        }}
      >
        <Loading text="Carregando dados da consulta..." />
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>⚠️</div>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Erro ao carregar</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          {error}
        </p>
        <button
          onClick={handleBack}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--primary)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  if (!consultationData) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📋</div>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Nenhum dado disponível</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Cadastre medicamentos e protocolos para visualizar dados na consulta.
        </p>
        <button
          onClick={handleBack}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--primary)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  return (
    <ConsultationView
      data={consultationData}
      {...handlers}
    />
  )
}
