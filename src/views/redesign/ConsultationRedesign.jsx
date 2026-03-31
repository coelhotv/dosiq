/**
 * ConsultationRedesign — Container view do Modo Consulta (Santuário Terapêutico).
 * Reutiliza 100% da lógica de dados do Consultation.jsx original.
 * Apenas o presenter muda (ConsultationViewRedesign).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { getCurrentUser } from '@shared/utils/supabase'
import { cachedAdherenceService } from '@shared/services/cachedServices'
import { getConsultationData } from '@features/consultation/services/consultationDataService'
import ConsultationViewRedesign from '@features/consultation/components/redesign/ConsultationViewRedesign'
import Loading from '@shared/components/ui/Loading'
import { analyticsService } from '@dashboard/services/analyticsService'
import { generateConsultationPDF } from '@features/reports/services/consultationPdfService'
import { formatLocalDate } from '@utils/dateUtils.js'
import './ConsultationRedesign.css'

export default function ConsultationRedesign({ onBack }) {
  const [isLoading, setIsLoading] = useState(true)
  const [consultationData, setConsultationData] = useState(null)
  const [error, setError] = useState(null)

  const { medicines, protocols, logs, stockSummary, stats, dailyAdherence } = useDashboard()

  const dashboardData = useMemo(
    () => ({ medicines, protocols, logs, stockSummary, stats, dailyAdherence }),
    [medicines, protocols, logs, stockSummary, stats, dailyAdherence]
  )

  // Create single 'now' instance for temporal consistency across PDF export, share, and filename generation
  const now = useMemo(() => new Date(), [])

  useEffect(() => {
    let isMounted = true

    const loadConsultationData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const user = await getCurrentUser()
        const resolvedName = user?.user_metadata?.name || user?.user_metadata?.full_name || ''
        const resolvedEmail = user?.email || ''
        if (!isMounted) return
        if (!dashboardData.medicines || !dashboardData.protocols) {
          if (isMounted) {
            setConsultationData(null)
            setIsLoading(false)
          }
          return
        }
        const data = getConsultationData(dashboardData, resolvedName, null, resolvedEmail)
        setConsultationData(data)
      } catch {
        if (!isMounted) return
        setError('Não foi possível carregar os dados para consulta.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadConsultationData()
    return () => {
      isMounted = false
    }
  }, [dashboardData])

  const handleGeneratePDF = useCallback(async () => {
    try {
      analyticsService.track('consultation_pdf_generated', { timestamp: Date.now() })
      const resolvedDailyAdherence = await cachedAdherenceService.getDailyAdherenceFromView(30)
      const pdfBlob = await generateConsultationPDF({
        consultationData,
        dashboardData: { ...dashboardData, dailyAdherence: resolvedDailyAdherence },
        period: '30d',
      })
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `consulta-medica-${formatLocalDate(now)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Erro ao gerar PDF. Tente novamente.')
    }
  }, [consultationData, dashboardData, now])

  const handleShare = useCallback(async () => {
    try {
      analyticsService.track('consultation_share_initiated', { timestamp: Date.now() })
      const resolvedDailyAdherence = await cachedAdherenceService.getDailyAdherenceFromView(30)
      const pdfBlob = await generateConsultationPDF({
        consultationData,
        dashboardData: { ...dashboardData, dailyAdherence: resolvedDailyAdherence },
        period: '30d',
      })
      const fileName = `consulta-medica-${formatLocalDate(now)}.pdf`

      // 1. Tentar Web Share API (mobile nativo)
      if (navigator.share && navigator.canShare) {
        try {
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Dados da Consulta Médica',
              text: 'Relatório de tratamento e adesão aos medicamentos',
              files: [file],
            })
            analyticsService.track('consultation_shared', { method: 'web_share_api' })
            return
          }
        } catch (shareErr) {
          console.warn('Web Share API failed, falling back to download:', shareErr)
          // Continua para download abaixo
        }
      }

      // 2. Fallback: Download direto do PDF
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      alert('PDF baixado com sucesso! Você pode compartilhá-lo manualmente.')
      analyticsService.track('consultation_shared', { method: 'download' })
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share error:', error)
        alert('Erro ao compartilhar. Tente novamente.')
      }
    }
  }, [consultationData, dashboardData, now])

  const handleBack = useCallback(() => {
    analyticsService.track('consultation_mode_closed', { timestamp: Date.now() })
    onBack?.()
  }, [onBack])

  if (isLoading) {
    return (
      <div className="cr-loading">
        <Loading text="Carregando dados da consulta..." />
      </div>
    )
  }

  if (error || !consultationData) {
    return (
      <div className="cr-error">
        <h2 className="cr-error__title">{error ? 'Erro ao carregar' : 'Nenhum dado disponível'}</h2>
        <p className="cr-error__message">
          {error || 'Cadastre medicamentos e protocolos para visualizar dados na consulta.'}
        </p>
        <button className="btn-primary" onClick={handleBack}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <ConsultationViewRedesign
      data={consultationData}
      onGeneratePDF={handleGeneratePDF}
      onShare={handleShare}
      onBack={handleBack}
    />
  )
}
