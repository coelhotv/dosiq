import { Clock } from 'lucide-react'
import { getNow, parseISO } from '@utils/dateUtils'
import { formatDoseItem } from '@dosiq/core'
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

  const isDelayed = doses[0]?.zone === 'late'
  const visibleDoses = doses.slice(0, DISPLAY_LIMIT)
  const overflowCount = doses.length - DISPLAY_LIMIT

  const nextTime = doses[0]?.scheduledTime || ''
  const scheduledFor = doses[0]?.scheduledFor
  const now = getNow()
  const scheduled = scheduledFor ? parseISO(scheduledFor) : now
  const diffMin = scheduledFor ? Math.round((scheduled.getTime() - now.getTime()) / 60000) : 0

  const TZ = 'America/Sao_Paulo'
  const isCarryOver =
    !!scheduledFor &&
    parseISO(scheduledFor).toLocaleDateString('pt-BR', { timeZone: TZ }) !==
      now.toLocaleDateString('pt-BR', { timeZone: TZ })

  const timeLabel = (() => {
    if (isCarryOver) {
      const weekday = parseISO(scheduledFor).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: TZ })
      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} às ${nextTime}`
    }
    if (diffMin <= 0) return 'Agora'
    if (diffMin < 60) return `Em ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`
    return `Às ${nextTime}`
  })()

  const handleCTA = () => {
    if (doses.length === 1) {
      onRegister?.(doses[0])
    } else {
      onRegisterAll?.(doses)
    }
  }

  // ═══ PRIORITY CARD ═══
  return (
    <div
      className={`priority-dose-card${isDelayed ? ' priority-dose-card--delayed' : ''}`}
      role="region"
      aria-label="Dose prioritária"
    >
      {/* Elemento decorativo para sensação "premium" */}
      <div className="priority-dose-card__decoration" aria-hidden="true" />

      {/* Header */}
      <div className="priority-dose-card__header">
        <span className="priority-dose-card__badge">
          {isDelayed ? '⚠ Atrasada' : '● Agora'}
        </span>
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
            <span className="priority-dose-card__item-text">
              <strong>{dose.medicineName}</strong>
              &nbsp;·&nbsp;{formatDoseItem(dose)}
            </span>
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
