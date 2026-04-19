/**
 * TitrationBadge — Badge de titulação com status e dias até próxima etapa
 * Exibido apenas quando isTitrationActive(protocol) === true
 */
import { formatDaysRemaining } from '@protocols/services/titrationService'

export default function TitrationBadge({ summary }) {
  if (!summary) return null

  const { currentStep, totalSteps, daysUntilNext, progressPercent } = summary

  return (
    <div className="titration-badge">
      <span className="titration-badge__icon">⚠</span>
      <span className="titration-badge__text">
        Titulação: Etapa {currentStep}/{totalSteps}
      </span>
      {daysUntilNext > 0 && (
        <span className="titration-badge__sub">
          · próxima em {formatDaysRemaining(daysUntilNext)}
        </span>
      )}
      {progressPercent > 0 && (
        <div className="titration-badge__progress">
          <div style={{ width: `${progressPercent}%` }} />
        </div>
      )}
    </div>
  )
}
