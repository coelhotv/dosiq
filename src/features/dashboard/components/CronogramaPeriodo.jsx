import { Sun, Moon, CheckCircle2, Circle } from 'lucide-react'

const PERIODS = [
  { id: 'morning',   label: 'Manhã',  Icon: Sun,  timeRange: [0,  12] },
  { id: 'afternoon', label: 'Tarde',  Icon: Sun,  timeRange: [12, 18] },
  { id: 'night',     label: 'Noite',  Icon: Moon, timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

function CronogramaDoseItem({ dose, onRegister }) {
  const done = dose.isRegistered

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-lg, 1rem)',
        background: done ? 'transparent' : 'var(--color-surface-container-lowest, #ffffff)',
        boxShadow: done ? 'none' : 'var(--shadow-editorial, 0 4px 24px -4px rgba(25, 28, 29, 0.04))',
        opacity: done ? 0.55 : 1,
        transition: 'all 200ms ease-out',
      }}
    >
      {done
        ? <CheckCircle2 size={20} color="var(--color-primary, #006a5e)" aria-hidden="true" />
        : <Circle size={20} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
      }

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          fontSize: 'var(--text-body-lg, 1rem)',
          color: 'var(--color-on-surface, #191c1d)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {dose.medicineName}
        </div>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          color: 'var(--color-on-surface-variant, #3e4946)',
        }}>
          {dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''} · {dose.scheduledTime}
        </div>
      </div>

      {!done && (
        <button
          onClick={() => onRegister?.(dose)}
          aria-label={`Registrar dose de ${dose.medicineName}`}
          style={{
            padding: '0.5rem 0.875rem',
            minHeight: '36px',
            background: 'var(--color-primary, #006a5e)',
            color: 'var(--color-on-primary, #ffffff)',
            border: 'none',
            borderRadius: 'var(--radius-full, 9999px)',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-label-md, 0.75rem)',
            fontWeight: 'var(--font-weight-bold, 700)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 150ms ease-out',
          }}
        >
          TOMAR
        </button>
      )}
    </div>
  )
}

/**
 * CronogramaPeriodo — Cronograma de doses agrupado por Manhã/Tarde/Noite.
 *
 * @param {Array} allDoses — Todas as doses do dia (flat: late+now+upcoming+later+done)
 * @param {Function} onRegister — callback: onRegister(dose)
 */
export default function CronogramaPeriodo({ allDoses = [], onRegister }) {
  const grouped = PERIODS.map(({ id, label, Icon, timeRange }) => {
    const [start, end] = timeRange
    const doses = allDoses
      .filter((d) => {
        const h = getHour(d.scheduledTime)
        return h >= start && h < end
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    return { id, label, Icon, doses }
  }).filter(({ doses }) => doses.length > 0)

  if (grouped.length === 0) return null

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-label="Cronograma de doses de hoje"
    >
      {grouped.map(({ id, label, Icon, doses }) => (
        <section key={id} aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}>
          {/* Header do período */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem', paddingLeft: '0.25rem',
          }}>
            <Icon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
            <h3 style={{
              margin: 0,
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontSize: 'var(--text-label-md, 0.75rem)',
              fontWeight: 'var(--font-weight-bold, 700)',
              color: 'var(--color-outline, #6d7a76)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              {label}
            </h3>
            <span style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-label-sm, 0.625rem)',
              color: 'var(--color-outline, #6d7a76)',
            }}>
              {doses.filter(d => d.isRegistered).length}/{doses.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {doses.map((dose) => (
              <CronogramaDoseItem
                key={`${dose.protocolId}-${dose.scheduledTime}`}
                dose={dose}
                onRegister={onRegister}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
