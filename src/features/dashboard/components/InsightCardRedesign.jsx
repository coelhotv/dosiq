import { TrendingUp, Target, Award, Package, Clock, AlertCircle, Lightbulb } from 'lucide-react'
import './InsightCardRedesign.css'

/**
 * InsightCardRedesign — Cartão redesenhado de insight inteligente (Wave 15.2)
 * Exibe insights com badge, ícone e CTA opcional
 *
 * @param {Object} props
 * @param {Object} props.insight - { id, type, icon?, title, message, priority, action? }
 *   - type: ADHERENCE_POSITIVE | ADHERENCE_MOTIVATIONAL | STREAK_CELEBRATION | STOCK_WARNING
 *           | PROTOCOL_REMINDER | MISSED_DOSE_ALERT | IMPROVEMENT_OPPORTUNITY
 *   - action: { label, type } (opcional)
 * @param {Function} props.onAction - Callback ao clicar em CTA: (insight) => void
 * @param {Function} props.onDismiss - Callback ao dispensar: (insightId) => void
 */
export default function InsightCardRedesign({ insight, onAction, onDismiss }) {
  // Handlers
  const handleCTA = () => {
    insight.onAction?.()
    onAction?.(insight)
  }

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(insight.id)
    }
  }

  /**
   * Retorna o label do badge baseado no tipo de insight
   */
  const getBadgeLabel = (type) => {
    const labels = {
      ADHERENCE_POSITIVE: 'Parabéns!',
      ADHERENCE_MOTIVATIONAL: 'Motivação',
      STREAK_CELEBRATION: 'Sequência!',
      STOCK_WARNING: 'Atenção',
      PROTOCOL_REMINDER: 'Lembrete',
      MISSED_DOSE_ALERT: 'Dose Perdida',
      IMPROVEMENT_OPPORTUNITY: 'Dica',
    }
    return labels[type] || 'Info'
  }

  /**
   * Retorna o componente Lucide correto baseado no tipo de insight
   */
  const getIconComponent = (type) => {
    const icons = {
      ADHERENCE_POSITIVE: TrendingUp,
      ADHERENCE_MOTIVATIONAL: Target,
      STREAK_CELEBRATION: Award,
      STOCK_WARNING: Package,
      PROTOCOL_REMINDER: Clock,
      MISSED_DOSE_ALERT: AlertCircle,
      IMPROVEMENT_OPPORTUNITY: Lightbulb,
    }
    const IconComponent = icons[type] || AlertCircle
    return <IconComponent size={20} aria-hidden="true" />
  }

  // Render
  return (
    <div className="insight-card-redesign" role="complementary" aria-label="Dica do dia">
      <div className="insight-card-redesign__header">
        <span className="insight-card-redesign__badge">{getBadgeLabel(insight.type)}</span>
        <div className="insight-card-redesign__icon-wrap">{getIconComponent(insight.type)}</div>
      </div>

      {insight.highlight && <p className="insight-card-redesign__title">{insight.highlight}</p>}
      <p className="insight-card-redesign__message">
        {insight.text ?? insight.message ?? insight.title}
      </p>

      {(insight.actionLabel ?? insight.action?.label) && (
        <button className="insight-card-redesign__cta" onClick={handleCTA}>
          {insight.actionLabel ?? insight.action.label} →
        </button>
      )}

      {onDismiss && (
        <button className="insight-card-redesign__dismiss" onClick={handleDismiss}>
          Dispensar
        </button>
      )}
    </div>
  )
}
