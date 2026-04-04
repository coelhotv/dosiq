import './ProtocolRiskBadge.css'

/**
 * Badge de risco de protocolo (Wave 15.4 — Smart Insights)
 *
 * Props:
 *   - risk: { adherence14d, trend7d, riskLevel, riskColor, riskLabel, hasEnoughData }
 *   - isComplex: boolean (true para dados complexos, false para simples)
 *
 * Lógica:
 *   - Se !risk.hasEnoughData → retorna null
 *   - Se !isComplex e riskLevel === 'stable' → retorna null
 *   - Se isComplex → sempre renderiza (inclusive stable)
 *     - Mostra aderência 14d + trend arrow (↑/↓/→)
 *   - Se !isComplex → renderiza apenas para atenção/crítico
 */
export default function ProtocolRiskBadge({ risk, isComplex }) {
  if (!risk || !risk.hasEnoughData) {
    return null
  }

  if (!isComplex && risk.riskLevel === 'stable') {
    return null
  }

  const trendArrow =
    risk.trend7d > 2 ? '↑' : risk.trend7d < -2 ? '↓' : '→'
  const trendLabel =
    risk.trend7d > 2 ? 'melhorando' : risk.trend7d < -2 ? 'piorando' : 'estável'

  if (!isComplex) {
    return (
      <span
        className={`risk-badge risk-badge--${risk.riskLevel}`}
        title={`Adesão 14 dias: ${Math.round(risk.adherence14d)}%`}
      >
        {risk.riskLabel}
      </span>
    )
  }

  return (
    <span className={`risk-badge risk-badge--${risk.riskLevel} risk-badge--complex`}>
      {risk.riskLabel}
      <span className="risk-badge__detail">
        {Math.round(risk.adherence14d)}%
        <span className="risk-badge__trend" aria-label={trendLabel}>
          {trendArrow}
        </span>
      </span>
    </span>
  )
}
