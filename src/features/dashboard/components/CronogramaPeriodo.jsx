import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon, CheckCircle2, Circle, Sunrise, ChevronRight } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'

const PERIODS = [
  { id: 'midnight',  label: 'Madrugada', Icon: Moon,    timeRange: [0,  6]  },
  { id: 'morning',   label: 'Manhã',     Icon: Sunrise, timeRange: [6,  12] },
  { id: 'afternoon', label: 'Tarde',     Icon: Sun,     timeRange: [12, 18] },
  { id: 'night',     label: 'Noite',     Icon: Moon,    timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

/**
 * CronogramaDoseItem — Card vertical layout (S7.5.1)
 * Icon (rounded square) → title + badge → dosage+time → full-width button
 *
 * @param {Object} dose — Dose item with stockStatus e stockDays (optional)
 * @param {Function} onRegister — callback para registrar dose
 */
function CronogramaDoseItem({ dose, onRegister, stockDays, stockStatus }) {
  const done = dose.isRegistered
  const showStockBadge = stockStatus === 'critical' || stockStatus === 'low'

  return (
    <div className={`cronograma-dose-card ${done ? 'cronograma-dose-card--done' : ''}`}>
      {/* Ícone em rounded square */}
      <div className="cronograma-dose-card__icon-wrap">
        {done
          ? <CheckCircle2 size={20} color="var(--color-primary, #006a5e)" aria-hidden="true" />
          : <Circle size={20} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
        }
      </div>

      {/* Título + Badge de estoque */}
      <div className="cronograma-dose-card__header">
        <div className="cronograma-dose-card__title">{dose.medicineName}</div>
        {showStockBadge && (
          <span className={`cronograma-dose-card__stock-badge cronograma-dose-card__stock-badge--${stockStatus}`}>
            {stockStatus === 'critical' ? 'Crítico' : stockStatus === 'low' ? 'Baixo' : ''}
            {stockDays !== null ? ` ${stockDays}d` : ''}
          </span>
        )}
      </div>

      {/* Dosagem + Horário */}
      <div className="cronograma-dose-card__dosage">
        {dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''} · {dose.scheduledTime}
      </div>

      {/* Botão TOMAR ou vazio se registrado */}
      {!done && (
        <button
          onClick={() => onRegister?.(dose)}
          aria-label={`Registrar dose de ${dose.medicineName}`}
          className="cronograma-dose-card__btn"
        >
          TOMAR
        </button>
      )}
    </div>
  )
}

/**
 * CronogramaPeriodo — Cronograma de doses agrupado por Madrugada/Manhã/Tarde/Noite.
 * Modo complex: zonas com accordion para concluídas
 * Modo simple: lista plana cronológica em 1 coluna
 *
 * @param {Array} allDoses — Todas as doses do dia (flat: late+now+upcoming+later+done)
 * @param {Function} onRegister — callback: onRegister(dose)
 * @param {string} variant — 'complex' (default) ou 'simple' para lista plana
 */
export default function CronogramaPeriodo({ allDoses = [], onRegister, variant = 'complex' }) {
  const { cascade } = useMotion()
  const [openZones, setOpenZones] = useState({})

  // ── Computar grouped para inicialização de accordion (S7.5.2) ──
  const grouped = useMemo(() => {
    const currentHour = new Date().getHours()
    return PERIODS.map(({ id, label, Icon, timeRange }) => {
      const [start, end] = timeRange
      const doses = allDoses
        .filter((d) => {
          const h = getHour(d.scheduledTime)
          return h >= start && h < end
        })
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

      // Classificar zona (S7.5.2)
      const isCurrent = currentHour >= start && currentHour < end
      const isPast = currentHour >= end
      const allDone = doses.every(d => d.isRegistered)
      const isCollapsible = isPast && allDone

      return { id, label, Icon, doses, isCurrent, isPast, isCollapsible }
    }).filter(({ doses }) => doses.length > 0)
  }, [allDoses])

  // Inicializar openZones via useEffect (S7.5.2: accordion state — apenas para complex)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Nota: openZones não está no dependency array para evitar loop infinito
    // A condição Object.keys(openZones).length === 0 garante que isso roda apenas uma vez
    if (variant === 'complex' && Object.keys(openZones).length === 0 && grouped.length > 0) {
      const currentZoneIndex = grouped.findIndex(g => g.isCurrent)
      const initialOpen = Object.fromEntries(
        grouped.map((z, idx) => {
          // Abrir: zona atual, ou próxima zona se atual está completa
          const shouldOpen = z.isCurrent || (currentZoneIndex >= 0 && idx === currentZoneIndex + 1 && grouped[currentZoneIndex].doses.every(d => d.isRegistered))
          return [z.id, shouldOpen ? true : !z.isCollapsible]
        })
      )
      setOpenZones(initialOpen)
    }
  }, [variant, grouped])

  // ── MODO SIMPLE: lista plana cronológica (S7.5.3) ──
  if (variant === 'simple') {
    const sorted = [...allDoses].sort((a, b) =>
      a.scheduledTime.localeCompare(b.scheduledTime)
    )
    return (
      <div className="cronograma-doses cronograma-doses--simple" aria-label="Cronograma de doses de hoje">
        {sorted.map((dose) => (
          <CronogramaDoseItem
            key={`${dose.protocolId}-${dose.scheduledTime}`}
            dose={dose}
            onRegister={onRegister}
            stockDays={dose.stockDays}
            stockStatus={dose.stockStatus}
          />
        ))}
      </div>
    )
  }

  // ── MODO COMPLEX: zonas com accordion (S7.5.2) ──

  if (grouped.length === 0) return null

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-label="Cronograma de doses de hoje"
      variants={cascade.container}
      initial="hidden"
      animate="visible"
    >
      {grouped.map(({ id, label, Icon, doses, isCollapsible }) => {
        const PeriodIcon = Icon
        const isOpen = openZones[id] ?? true

        return (
          <motion.section
            key={id}
            aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}
            variants={cascade.item}
          >
            {/* Header com accordion se concluído (S7.5.2) */}
            {isCollapsible ? (
              <button
                className="cronograma-period-header cronograma-period-header--done"
                onClick={() => setOpenZones(prev => ({ ...prev, [id]: !prev[id] }))}
                aria-expanded={isOpen}
              >
                <PeriodIcon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
                <span className="cronograma-period-header__label">{label}</span>
                <span className="cronograma-period-header__done-tag">· Concluído</span>
                <CheckCircle2 size={14} color="var(--color-primary, #006a5e)" aria-hidden="true" />
                <ChevronRight
                  size={16}
                  className={`cronograma-period-header__chevron ${isOpen ? 'cronograma-period-header__chevron--open' : ''}`}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '0.75rem', paddingLeft: '0.25rem',
              }}>
                <PeriodIcon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
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
            )}

            {/* Doses — renderizar se aberto */}
            {isOpen && (
              <div className="cronograma-doses">
                {doses.map((dose) => (
                  <CronogramaDoseItem
                    key={`${dose.protocolId}-${dose.scheduledTime}`}
                    dose={dose}
                    onRegister={onRegister}
                    stockDays={dose.stockDays}
                    stockStatus={dose.stockStatus}
                  />
                ))}
              </div>
            )}
          </motion.section>
        )
      })}
    </motion.div>
  )
}
