/**
 * Consultation — Container view do Modo Consulta (Santuário Terapêutico).
 * Reutiliza 100% da lógica de dados do Consultation.jsx original.
 * Apenas o presenter muda (ConsultationView).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { getCurrentUser, getUserId, supabase } from '@shared/utils/supabase'
import { cachedAdherenceService } from '@shared/services/cachedServices'
import { getConsultationData } from '@features/consultation/services/consultationDataService'
import ConsultationView from '@features/consultation/components/ConsultationView'
import Loading from '@shared/components/ui/Loading'
import { analyticsService } from '@dashboard/services/analyticsService'
import { getNow } from '@utils/dateUtils'
import { attachFullLadders } from '@dosiq/core'
import './Consultation.css'

/**
 * Busca os sumários de adesão instance-based (30d + 90d) p/ injetar na consulta.
 * Swallow + DEV-log em falha (retorna null): não derruba o resto da consulta (Gemini #620).
 */
async function fetchAdherenceSummaries() {
  try {
    const [last30d, last90d] = await Promise.all([
      cachedAdherenceService.getAdherenceSummary('30d'),
      cachedAdherenceService.getAdherenceSummary('90d'),
    ])
    return { last30d, last90d }
  } catch (err) {
    if (import.meta.env.DEV) console.error('Erro ao carregar sumários de adesão para consulta:', err)
    return null
  }
}

/**
 * Escada COMPLETA de titulação dos tratamentos (029 F6 / AP-311).
 *
 * 🔴 O embed `titration_steps(...)` que vem no select de `protocols` resolve pela FK
 * `protocol_id`, que só marca o executor VIGENTE e fica NULL na maioria das etapas — a etapa
 * `current` costuma ficar de fora. Num documento clínico isso vira uma escada mutilada (ou
 * ausente). A identidade da escada é a `titration_id`; a derivação é a do core, a mesma da
 * listagem de tratamentos e do mobile.
 *
 * R-295: colunas conferidas em `information_schema` (2026-08-22) e select byte-idêntico ao já
 * executado em produção por `useTreatmentList` (a tabela não é legível por `anon` — o curl de
 * saída ali é o mesmo contrato).
 *
 * Best-effort (R-245): sem escada a consulta segue útil; o erro é logado, nunca silenciado.
 */
async function fetchProtocolsWithLadders(protocols) {
  if (!Array.isArray(protocols) || protocols.length === 0) return protocols
  try {
    const userId = await getUserId()
    const { data: steps, error } = await supabase
      .from('titration_steps')
      .select('id, titration_id, protocol_id, position, dose, intake_unit, duration_days, status, started_at, medicine_id')
      .eq('user_id', userId)
      .order('position', { ascending: true })
    if (error) throw error

    const { protocols: withLadders, orphanTitrationIds } = attachFullLadders(protocols, steps)
    for (const titrationId of orphanTitrationIds) {
      console.error(
        `Titulação órfã ${titrationId}: nenhuma etapa carrega protocol_id — o tratamento fica sem escada na consulta e no PDF (AP-311)`
      )
    }
    return withLadders
  } catch (err) {
    console.error('Escada de titulação indisponível (consulta segue com o embed recortado):', err)
    return protocols
  }
}

export default function Consultation({ onBack }) {
  const [isLoading, setIsLoading] = useState(true)
  const [consultationData, setConsultationData] = useState(null)
  const [error, setError] = useState(null)

  const { medicines, protocols, logs, stockSummary, stats, dailyAdherence } = useDashboard()
  const { enabled: stockTrackingEnabled } = useStockTracking()

  // `stockTrackingEnabled` viaja explícito para a tela da consulta (dose-only, 044). O PDF lê o
  // próprio ajuste no coletor do core (097).
  const dashboardData = useMemo(
    () => ({ medicines, protocols, logs, stockSummary, stats, dailyAdherence, stockTrackingEnabled }),
    [medicines, protocols, logs, stockSummary, stats, dailyAdherence, stockTrackingEnabled]
  )

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
        // Sumários instance-based (ADR-054, Opção A) — helper faz swallow em falha.
        const adherenceSummaries = await fetchAdherenceSummaries()
        if (!isMounted) return
        const ladderProtocols = await fetchProtocolsWithLadders(dashboardData.protocols)
        if (!isMounted) return
        const data = getConsultationData(
          { ...dashboardData, protocols: ladderProtocols },
          resolvedName, null, resolvedEmail, user?.id, adherenceSummaries
        )
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

  // 097 A2 (D-A2-2): o mesmo fluxo do Perfil — PDF gerado no servidor, 30 dias. "Gerar PDF" baixa o
  // arquivo; "Compartilhar" abre o menu nativo com o arquivo (cai no download quando o navegador não
  // compartilha arquivos).
  useEffect(() => {
    import('@features/reports/services/reportDownloadFlow')
      .then((flow) => flow.warmReportEndpoint())
      .catch(() => {})
  }, [])

  const handleGeneratePDF = useCallback(async () => {
    try {
      analyticsService.track('consultation_pdf_generated', { timestamp: getNow().getTime() })
      const flow = await import('@features/reports/services/reportDownloadFlow')
      flow.downloadReportFile(await flow.fetchClinicalReport(30))
    } catch {
      alert('Erro ao gerar PDF. Tente novamente.')
    }
  }, [])

  const handleShare = useCallback(async () => {
    try {
      analyticsService.track('consultation_share_initiated', { timestamp: getNow().getTime() })
      const flow = await import('@features/reports/services/reportDownloadFlow')
      const report = await flow.fetchClinicalReport(30)
      if (flow.canShareReportFile(report)) {
        await flow.shareReportFile(report)
        analyticsService.track('consultation_shared', { method: 'web_share_api' })
      } else {
        flow.downloadReportFile(report)
        analyticsService.track('consultation_shared', { method: 'download' })
      }
    } catch {
      alert('Erro ao compartilhar. Tente novamente.')
    }
  }, [])

  const handleBack = useCallback(() => {
    analyticsService.track('consultation_mode_closed', { timestamp: getNow().getTime() })
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
          {error || 'Cadastre medicamentos e tratamentos para visualizar dados na consulta.'}
        </p>
        <button className="btn-primary" onClick={handleBack}>
          Voltar
        </button>
      </div>
    )
  }

  return (
    <ConsultationView
      data={consultationData}
      onGeneratePDF={handleGeneratePDF}
      onShare={handleShare}
      onBack={handleBack}
    />
  )
}
