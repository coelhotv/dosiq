import { Clock } from 'lucide-react'
import { getNow } from '@utils/dateUtils'
import './PriorityDoseCard.css'

/**
 * PriorityDoseCard — Destaque visual para doses urgentes (late + now).
 * Exibe até 3 medicamentos; overflow aparece como "+ N medicamentos".
 * O CTA "Confirmar Agora" registra TODOS (não só os visíveis).
 *
 * @param {Array} doses — DoseItem[] (late + now não registradas)
 * @param {Function} onRegister — onRegister(dose) — para dose única
 * @param {Function} onRegisterAll — onRegisterAll(doses) — para múltiplas
 */
const DISPLAY_LIMIT = 3

export default function PriorityDoseCard({ doses = [], onRegister, onRegisterAll }) {
  if (!doses || doses.length === 0) return null

  const visibleDoses = doses.slice(0, DISPLAY_LIMIT)
  const overflowCount = doses.length - DISPLAY_LIMIT

  const nextTime = doses[0]?.scheduledTime || ''
  const now = getNow()
  const [hour, minute] = nextTime.split(':').map(Number)
  const scheduled = getNow()
  scheduled.setHours(hour, minute, 0, 0)
  const diffMin = Math.round((scheduled - now) / 60000)

  const timeLabel =
    diffMin <= 0
      ? 'Agora'
      : diffMin < 60
        ? `Em ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`
        : `Às ${nextTime}`

  const handleCTA = () => {
    if (doses.length === 1) {
      onRegister?.(doses[0])
    } else {
      onRegisterAll?.(doses)
    }
  }

  // ═══ PRIORITY CARD ═══
  return (
    <div className="priority-dose-card" role="region" aria-label="Dose prioritária">
      {/* Elemento decorativo para sensação "premium" */}
      <div className="priority-dose-card__decoration" aria-hidden="true" />

      {/* Header */}
      <div className="priority-dose-card__header">
        <span className="priority-dose-card__badge">● Prioridade Máxima</span>
        <span className="priority-dose-card__time-wrap">
          <Clock size={16} aria-hidden="true" />
          {nextTime}
        </span>
      </div>

      {/* Tempo relativo */}
      <p className="priority-dose-card__relative-time">{timeLabel}</p>

      {/* Lista de medicamentos — exibe até 3, com linha de overflow */}
      <ul className="priority-dose-card__list">
        {visibleDoses.map((dose) => (
          <li
            key={`${dose.protocolId}-${dose.scheduledTime}`}
            className="priority-dose-card__item"
          >
            <span className="priority-dose-card__bullet" aria-hidden="true" />
            <strong>{dose.medicineName}</strong>
            &nbsp;·&nbsp;{dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''}
          </li>
        ))}
        {overflowCount > 0 && (
          <li className="priority-dose-card__overflow">
            + {overflowCount} medicamento{overflowCount !== 1 ? 's' : ''}
          </li>
        )}
      </ul>

      {/* CTA — registra TODOS os doses (não só os visíveis) */}
      <button
        className="priority-dose-card__cta"
        onClick={handleCTA}
        aria-label={`Confirmar ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}
      >
        Confirmar Agora
      </button>
    </div>
  )
}
