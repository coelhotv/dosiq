import { Clock } from 'lucide-react'
import { getNow } from '@utils/dateUtils'

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
    <div
      role="region"
      aria-label="Dose prioritária"
      style={{
        background:
          'linear-gradient(135deg, var(--color-secondary, #005db6), var(--color-secondary-container, #63a1ff))',
        borderRadius: 'var(--radius-card, 2rem)',
        padding: '1.5rem',
        color: '#ffffff',
        boxShadow: '0 8px 32px rgba(0, 93, 182, 0.25)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <span
          style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-full, 9999px)',
            padding: '0.25rem 0.75rem',
            fontSize: 'var(--text-label-sm, 0.625rem)',
            fontWeight: 'var(--font-weight-bold, 700)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ● Prioridade Máxima
        </span>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: 'var(--text-title-lg, 1.125rem)',
            fontWeight: 'var(--font-weight-bold, 700)',
            fontFamily: 'var(--font-display, Public Sans, sans-serif)',
          }}
        >
          <Clock size={16} aria-hidden="true" />
          {nextTime}
        </span>
      </div>

      {/* Tempo relativo */}
      <p
        style={{
          margin: '0 0 1rem',
          fontSize: 'var(--text-body-lg, 1rem)',
          opacity: 0.85,
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
        }}
      >
        {timeLabel}
      </p>

      {/* Lista de medicamentos — exibe até 3, com linha de overflow */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {visibleDoses.map((dose) => (
          <li
            key={`${dose.protocolId}-${dose.scheduledTime}`}
            style={{
              fontSize: 'var(--text-body-lg, 1rem)',
              opacity: 0.9,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.7)',
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <strong>{dose.medicineName}</strong>
            &nbsp;·&nbsp;{dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''}
          </li>
        ))}
        {overflowCount > 0 && (
          <li
            style={{
              fontSize: 'var(--text-body-md, 0.875rem)',
              opacity: 0.7,
              paddingLeft: '0.875rem',
            }}
          >
            + {overflowCount} medicamento{overflowCount !== 1 ? 's' : ''}
          </li>
        )}
      </ul>

      {/* CTA — registra TODOS os doses (não só os visíveis) */}
      <button
        onClick={handleCTA}
        aria-label={`Confirmar ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}
        style={{
          width: '100%',
          padding: '1rem',
          minHeight: '56px',
          background: 'rgba(255,255,255,0.95)',
          color: 'var(--color-secondary, #005db6)',
          border: 'none',
          borderRadius: 'var(--radius-button, 1.25rem)',
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-title-lg, 1.125rem)',
          fontWeight: 'var(--font-weight-bold, 700)',
          cursor: 'pointer',
          transition: 'all 200ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Confirmar Agora
      </button>
    </div>
  )
}
