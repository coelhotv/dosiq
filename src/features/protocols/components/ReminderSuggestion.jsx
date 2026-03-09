import { dismissSuggestion } from '@features/protocols/services/reminderOptimizerService'
import './ReminderSuggestion.css'

/**
 * Notificação in-app não-intrusiva para sugestão de ajuste de horário.
 *
 * Props:
 * - suggestion: { currentTime, suggestedTime, avgDeltaMinutes, sampleCount }
 * - protocolId: string
 * - protocolName: string
 * - onAccept: (newTime: string) => void  // Chama protocolService.update()
 * - onDismiss: () => void
 */
export default function ReminderSuggestion({
  suggestion,
  protocolId,
  protocolName,
  onAccept,
  onDismiss,
}) {
  // Guard clause: sugestão inválida
  if (!suggestion) {
    return null
  }

  const handleAccept = () => {
    onAccept(suggestion.suggestedTime)
  }

  const handleKeep = () => {
    dismissSuggestion(protocolId, false) // 30 dias
    onDismiss()
  }

  const handleNeverAsk = () => {
    dismissSuggestion(protocolId, true) // Permanente
    onDismiss()
  }

  return (
    <div className="reminder-suggestion" role="alert">
      <div className="reminder-suggestion__content">
        <p className="reminder-suggestion__text">
          Você costuma tomar <strong>{protocolName}</strong> por volta das{' '}
          <strong>{suggestion.suggestedTime}</strong>. Quer ajustar o lembrete de{' '}
          {suggestion.currentTime} para {suggestion.suggestedTime}?
        </p>
        <p className="reminder-suggestion__sample">
          (baseado em {suggestion.sampleCount} doses)
        </p>
      </div>

      <div className="reminder-suggestion__actions">
        <button
          onClick={handleAccept}
          className="reminder-suggestion__button reminder-suggestion__button--primary"
          type="button"
        >
          Ajustar
        </button>
        <button
          onClick={handleKeep}
          className="reminder-suggestion__button reminder-suggestion__button--secondary"
          type="button"
        >
          Manter
        </button>
        <button
          onClick={handleNeverAsk}
          className="reminder-suggestion__button reminder-suggestion__button--tertiary"
          type="button"
        >
          Não perguntar mais
        </button>
      </div>
    </div>
  )
}
