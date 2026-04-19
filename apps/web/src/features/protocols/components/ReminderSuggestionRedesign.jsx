import './ReminderSuggestionRedesign.css'
import { dismissSuggestion } from '@features/protocols/services/reminderOptimizerService'
import { BellRing } from 'lucide-react'

/**
 * Componente redesenhado de sugestão de lembrete (Wave 15.3)
 * Drop-in replacement para ReminderSuggestion.jsx
 *
 * Props:
 *   - suggestion: { currentTime, suggestedTime, avgDeltaMinutes, sampleCount, direction }
 *   - protocolId: string
 *   - protocolName: string
 *   - onAccept: (suggestedTime: string) => void
 *   - onDismiss: () => void
 */
export default function ReminderSuggestionRedesign({
  suggestion,
  protocolId,
  protocolName,
  onAccept,
  onDismiss,
}) {
  return (
    <div className="reminder-suggestion-redesign" role="alert">
      <span className="reminder-suggestion-redesign__badge">
        <BellRing size={14} aria-hidden="true" />
        Sugestão Inteligente
      </span>
      <p className="reminder-suggestion-redesign__text">
        Você costuma tomar <strong>{protocolName}</strong> por volta das{' '}
        <strong>{suggestion.suggestedTime}</strong>.
      </p>
      <p className="reminder-suggestion-redesign__subtext">
        Ajustar o lembrete de {suggestion.currentTime} para {suggestion.suggestedTime}?
      </p>
      <p className="reminder-suggestion-redesign__sample">
        Baseado em {suggestion.sampleCount} doses registradas
      </p>
      <div className="reminder-suggestion-redesign__actions">
        <button
          className="reminder-suggestion-redesign__btn reminder-suggestion-redesign__btn--accept"
          onClick={() => onAccept(suggestion.suggestedTime)}
        >
          Ajustar Horário
        </button>
        <button
          className="reminder-suggestion-redesign__btn reminder-suggestion-redesign__btn--keep"
          onClick={() => {
            dismissSuggestion(protocolId, false)
            onDismiss()
          }}
        >
          Manter Atual
        </button>
      </div>
      <button
        className="reminder-suggestion-redesign__never"
        onClick={() => {
          dismissSuggestion(protocolId, true)
          onDismiss()
        }}
      >
        Não perguntar mais
      </button>
    </div>
  )
}
