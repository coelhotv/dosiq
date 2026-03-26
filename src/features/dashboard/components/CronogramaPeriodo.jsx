import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon, CheckCircle2, Circle, Sunrise, ChevronRight, Pill, PillBottle } from 'lucide-react'
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
  // S7.5 visual: mostrar ícone baseado no tipo de medicamento
  const isSupplement = dose.medicineType === 'suplemento'
  const MedicineIcon = isSupplement ? PillBottle : Pill

  return (
    <div className={`cronograma-dose-card ${done ? 'cronograma-dose-card--done' : ''}`}>
      {/* Ícone em rounded square — S7.5: Pill (medicamento) vs Capsule (suplemento) */}
      <div className={`cronograma-dose-card__icon-wrap cronograma-dose-card__icon-wrap--${isSupplement ? 'supplement' : 'medicine'}`}>
        {done
          ? <CheckCircle2 size={20} color="var(--color-primary, #006a5e)" aria-hidden="true" />
          : <MedicineIcon size={20} color="#ffffff" aria-hidden="true" />
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
 * @param {Date} now — Instância de data sincronizada com useDoseZones para consistência temporal
 */
export default function CronogramaPeriodo({ allDoses = [], onRegister, variant = 'complex', now = new Date() }) {
  const { cascade } = useMotion()

  // ── Computar grouped para inicialização de accordion (S7.5.2) ──
  const grouped = useMemo(() => {
    const currentHour = now.getHours()
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
  }, [allDoses, now])

  // Inicializar openZones: zonas passadas fechadas, atual + próximas abertas (S7.5.2)
  const [openZones, setOpenZones] = useState(() => {
    if (grouped.length === 0) return {}
    return Object.fromEntries(
      grouped.map(z => {
        // Zonas passadas: começam fechadas | Atual + futuras: começam abertas
        return [z.id, !z.isPast]
      })
    )
  })

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
      {grouped.map(({ id, label, Icon, doses, isPast }) => {
        const PeriodIcon = Icon
        const isOpen = openZones[id]

        return (
          <motion.section
            key={id}
            aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}
            variants={cascade.item}
          >
            {/* Header accordion — S7.5.2: todos os headers clicáveis */}
            {/* Zonas passadas aparecem com "Concluído", outras mostram contagem */}
            <button
              className="cronograma-period-header"
              onClick={() => setOpenZones(prev => ({ ...prev, [id]: !prev[id] }))}
              aria-expanded={isOpen}
            >
              <PeriodIcon size={16} color="var(--color-outline, #6d7a76)" aria-hidden="true" />
              <span className="cronograma-period-header__label">{label}</span>

              {/* Indicadores à direita: "Concluído" ou contagem + chevron */}
              <div className="cronograma-period-header__right">
                {isPast ? (
                  <>
                    <span className="cronograma-period-header__done-tag">· Concluído</span>
                    <CheckCircle2 size={14} color="var(--color-primary, #006a5e)" aria-hidden="true" />
                  </>
                ) : (
                  <span className="cronograma-period-header__count">
                    {doses.filter(d => d.isRegistered).length}/{doses.length}
                  </span>
                )}
                <ChevronRight
                  size={16}
                  className={`cronograma-period-header__chevron ${isOpen ? 'cronograma-period-header__chevron--open' : ''}`}
                  aria-hidden="true"
                />
              </div>
            </button>

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
