import { calculateExpectedDoses } from '@utils/adherenceLogic'
import { getNow, addDays, getSaoPauloTime, parseISO } from '@utils/dateUtils'

/**
 * Niveis de risco para protocolos.
 */
export const RISK_LEVELS = {
  STABLE: 'stable',
  ATTENTION: 'attention',
  CRITICAL: 'critical',
}

export const RISK_COLORS = {
  stable: 'var(--color-success)', // #22c55e
  attention: 'var(--color-warning)', // #f59e0b
  critical: 'var(--color-error)', // #ef4444
}

export const RISK_LABELS = {
  stable: 'Estável',
  attention: 'Atenção',
  critical: 'Crítico',
}

/**
 * Calcula score de risco para um protocolo.
 *
 * @param {Object} params
 * @param {string} params.protocolId
 * @param {Array} params.logs - TODOS os logs do usuario (sera filtrado internamente)
 * @param {Object} params.protocol - Protocolo com time_schedule, frequency, dosage_per_intake
 * @returns {{
 *   protocolId: string,
 *   adherence14d: number,    // 0-100
 *   trend7d: number,         // delta percentual (-100 a +100)
 *   riskLevel: 'stable'|'attention'|'critical',
 *   riskColor: string,
 *   riskLabel: string,
 *   hasEnoughData: boolean
 * }}
 */
export function calculateProtocolRisk({ protocolId, logs, protocol }) {
  const now = getNow()
  const fourteenDaysAgo = getSaoPauloTime(addDays(now, -14))
  fourteenDaysAgo.setHours(0, 0, 0, 0)

  const sevenDaysAgo = getSaoPauloTime(addDays(now, -7))
  sevenDaysAgo.setHours(0, 0, 0, 0)

  // Filtrar logs APENAS deste protocolo (fix: Gemini issue #4, nao OR por medicine_id)
  const protocolLogs = logs.filter((log) => log.protocol_id === protocolId)

  // Adesao ultimos 14 dias - usar sum of quantity_taken, nao contagem de logs (fix: Gemini issue #2)
  const logs14d = protocolLogs.filter((log) => getSaoPauloTime(parseISO(log.taken_at)) >= fourteenDaysAgo)
  const expected14d = calculateExpectedDoses([protocol], 14)
  const totalTaken14d = logs14d.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0)
  const adherence14d =
    expected14d > 0 ? Math.min(100, Math.round((totalTaken14d / expected14d) * 100)) : 100

  // Adesao ultimos 7 dias vs 7 dias anteriores (trend) - fix: Gemini issue #3
  const logs7d = protocolLogs.filter((log) => getSaoPauloTime(parseISO(log.taken_at)) >= sevenDaysAgo)
  const logsPrev7d = protocolLogs.filter((log) => {
    const logDate = getSaoPauloTime(parseISO(log.taken_at))
    return logDate >= fourteenDaysAgo && logDate < sevenDaysAgo
  })

  const expected7d = calculateExpectedDoses([protocol], 7)
  const totalTaken7d = logs7d.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0)
  const totalTakenPrev7d = logsPrev7d.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0)
  const adherence7d = expected7d > 0 ? (totalTaken7d / expected7d) * 100 : 100
  const adherencePrev7d = expected7d > 0 ? (totalTakenPrev7d / expected7d) * 100 : 100
  const trend7d = Math.round(adherence7d - adherencePrev7d)

  // Verificar dados suficientes
  const hasEnoughData = expected14d >= 4 // Pelo menos ~2 doses/semana

  // Classificar risco
  let riskLevel
  if (!hasEnoughData) {
    riskLevel = RISK_LEVELS.STABLE // Nao penalizar sem dados
  } else if (adherence14d < 50 || trend7d < -15) {
    riskLevel = RISK_LEVELS.CRITICAL
  } else if (adherence14d < 80 || (trend7d >= -15 && trend7d < -5)) {
    riskLevel = RISK_LEVELS.ATTENTION
  } else {
    riskLevel = RISK_LEVELS.STABLE
  }

  return {
    protocolId,
    adherence14d,
    trend7d,
    riskLevel,
    riskColor: RISK_COLORS[riskLevel],
    riskLabel: RISK_LABELS[riskLevel],
    hasEnoughData,
  }
}

/**
 * Calcula risco para TODOS os protocolos ativos.
 */
export function calculateAllProtocolRisks({ protocols, logs }) {
  return protocols
    .filter((p) => p.active)
    .map((protocol) =>
      calculateProtocolRisk({
        protocolId: protocol.id,
        logs,
        protocol,
      })
    )
}
