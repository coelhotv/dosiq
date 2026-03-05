/**
 * PlanBadge — Badge visual de plano de tratamento (W2-05)
 *
 * Exibe emoji + cor de fundo para identificar o plano ao qual uma dose pertence.
 * Em modo time do DoseZoneList, fornece contexto clínico inline.
 */

import './PlanBadge.css'

/**
 * @param {Object} props
 * @param {string} props.emoji - Emoji do plano (ex: "🫀")
 * @param {string} props.color - Cor CSS (ex: "var(--color-error)")
 * @param {string} [props.planName] - Nome do plano (para title/tooltip)
 * @param {'sm'|'md'} [props.size='sm']
 * @param {Function} [props.onClick]
 */
export default function PlanBadge({ emoji, color, planName, size = 'sm', onClick }) {
  return (
    <span
      className={`plan-badge plan-badge--${size}`}
      style={{ '--badge-color': color }}
      title={planName}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={planName ? `Plano: ${planName}` : undefined}
    >
      {emoji}
    </span>
  )
}
