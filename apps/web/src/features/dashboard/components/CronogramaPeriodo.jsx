import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Sun,
  Moon,
  Sunrise,
  ChevronRight,
  Pill,
  PillBottle,
  CheckCircle2,
  CircleCheckBig,
  CircleAlert,
  Circle,
} from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { getNow } from '@utils/dateUtils'
import { DOSE_REGISTRATION_TOLERANCE_MS } from '@dashboard/hooks/useDoseZones'

// Janela ±120min — fonte única em useDoseZones. Reutilizada para getDoseStatus e isWithinActionWindow.
const LATE_WINDOW_MINUTES = DOSE_REGISTRATION_TOLERANCE_MS / 60_000

const PERIODS = [
  { id: 'midnight', label: 'Madrugada', Icon: Moon, timeRange: [0, 6] },
  { id: 'morning', label: 'Manhã', Icon: Sunrise, timeRange: [6, 12] },
  { id: 'afternoon', label: 'Tarde', Icon: Sun, timeRange: [12, 18] },
  { id: 'night', label: 'Noite', Icon: Moon, timeRange: [18, 24] },
]

function getHour(scheduledTime) {
  return parseInt(scheduledTime.split(':')[0], 10)
}

/**
 * Determina o status de uma dose baseado em registro e horário agendado.
 * Uma dose é "missed" apenas quando passou mais de 2h do horário agendado (mesma janela de classifyDose).
 * @param {Object} dose
 * @param {Date} now
 * @returns {'done'|'missed'|'pending'}
 */
function getDoseStatus(dose, now) {
  if (dose.isRegistered) return 'done'
  const [h, m] = dose.scheduledTime.split(':').map(Number)
  const scheduledMinutes = h * 60 + m
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  // Perdida somente após 2h do horário agendado
  return nowMinutes - scheduledMinutes > LATE_WINDOW_MINUTES ? 'missed' : 'pending'
}

/**
 * Verifica se a dose está dentro da janela de ação (±2h do horário agendado).
 * Fora da janela: botão TOMAR não exibido (muito cedo ou muito tarde).
 */
function isWithinActionWindow(dose, now) {
  const [h, m] = dose.scheduledTime.split(':').map(Number)
  const scheduledMinutes = h * 60 + m
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return Math.abs(nowMinutes - scheduledMinutes) <= LATE_WINDOW_MINUTES
}

/**
 * CronogramaDoseItem — Card com status diferenciado: done / missed / pending
 */
function CronogramaDoseItem({ dose, onRegister, stockDays, stockStatus, now }) {
  const status = getDoseStatus(dose, now)
  const canTake = status === 'pending' && isWithinActionWindow(dose, now)
  const done = status === 'done'
  const missed = status === 'missed'
  const showStockBadge = !missed && (stockStatus === 'critical' || stockStatus === 'low')
  const isSupplement = dose.medicineType === 'suplemento'
  const MedicineIcon = isSupplement ? PillBottle : Pill

  return (
    <div className={`cronograma-dose-card cronograma-dose-card--${status}`}>
      {/* Status icon — topo-direita (posição absoluta) */}
      {done && (
        <CircleCheckBig
          size={18}
          className="cronograma-dose-card__status-icon"
          color="var(--color-primary, #006a5e)"
          aria-label="Dose registrada"
        />
      )}
      {missed && (
        <CircleAlert
          size={18}
          className="cronograma-dose-card__status-icon"
          color="var(--color-warning, #f59e0b)"
          aria-label="Dose perdida"
        />
      )}

      {/* Ícone do tipo */}
      <div
        className={`cronograma-dose-card__icon-wrap cronograma-dose-card__icon-wrap--${isSupplement ? 'supplement' : 'medicine'}`}
      >
        <MedicineIcon size={20} color="#ffffff" aria-hidden="true" />
      </div>

      {/* Bloco principal: info à esquerda, horário grande à direita */}
      <div className="cronograma-dose-card__main">
        <div className="cronograma-dose-card__details">
          {/* Linha 1: nome + concentração */}
          <div className="cronograma-dose-card__name-row">
            <span className="cronograma-dose-card__title">{dose.medicineName}</span>
            {dose.dosagePerPill && dose.dosageUnit && (
              <span className="cronograma-dose-card__strength">
                {dose.dosagePerPill}
                {dose.dosageUnit}
              </span>
            )}
          </div>
          {/* Linha 2: quantidade por dose + badge de estoque */}
          <div className="cronograma-dose-card__intake-row">
            <span className="cronograma-dose-card__intake">
              {dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''}
            </span>
            {showStockBadge && (
              <span
                className={`cronograma-dose-card__stock-badge cronograma-dose-card__stock-badge--${stockStatus}`}
              >
                {stockStatus === 'critical' ? 'Crítico' : 'Baixo'}
                {stockDays !== null ? ` ${stockDays}d` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Horário — grande, ocupa a altura de ambas as linhas */}
        <time className="cronograma-dose-card__time" dateTime={dose.scheduledTime}>
          {dose.scheduledTime}
        </time>
      </div>

      {/* Botão TOMAR: apenas dentro da janela ±2h */}
      {canTake && (
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
 *
 * Sempre exibe as 4 zonas durante todo o dia.
 * - Zonas passadas: dimmed + fechadas ao carregar
 * - Zonas vazias: sempre fechadas, mostram empty state ao abrir
 * - Status diferenciado por dose: done / missed / pending
 *
 * @param {Array} allDoses — Todas as doses do dia (expandProtocolsToDoses, enriquecidas com stock)
 * @param {Function} onRegister — callback: onRegister(dose)
 * @param {string} variant — 'complex' (default) ou 'simple' para lista plana
 * @param {Date} now — Instância de data sincronizada com useDoseZones
 */
export default function CronogramaPeriodo({
  allDoses = [],
  onRegister,
  variant = 'complex',
  now = getNow(),
}) {
  const { cascade } = useMotion()
  const didInitRef = useRef(false)

  const currentHour = now.getHours()

  // Estado inicial baseado no horário atual: passados → fechados, atual/futuros → abertos
  const [openZones, setOpenZones] = useState(() =>
    Object.fromEntries(
      PERIODS.map(({ id, timeRange }) => {
        const [, end] = timeRange
        return [id, currentHour < end]
      })
    )
  )

  // Após primeiro carregamento de dados: fechar zonas vazias
  useEffect(() => {
    if (didInitRef.current || allDoses.length === 0) return
    didInitRef.current = true
    setOpenZones((prev) => {
      const next = { ...prev }
      PERIODS.forEach(({ id, timeRange }) => {
        const [start, end] = timeRange
        const hasDoses = allDoses.some((d) => {
          const h = getHour(d.scheduledTime)
          return h >= start && h < end
        })
        if (!hasDoses) next[id] = false
      })
      return next
    })
  }, [allDoses])

  // Agrupar doses por período (sempre 4 períodos — sem .filter)
  const grouped = useMemo(() => {
    return PERIODS.map(({ id, label, Icon, timeRange }) => {
      const [start, end] = timeRange
      const isPast = currentHour >= end
      const isCurrent = currentHour >= start && currentHour < end
      const doses = allDoses
        .filter((d) => {
          const h = getHour(d.scheduledTime)
          return h >= start && h < end
        })
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))

      return { id, label, Icon, doses, isPast, isCurrent }
    })
  }, [allDoses, currentHour])

  // ── MODO SIMPLE: lista plana cronológica ──
  if (variant === 'simple') {
    const sorted = [...allDoses].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    if (sorted.length === 0) return null
    return (
      <div
        className="cronograma-doses cronograma-doses--simple"
        aria-label="Cronograma de doses de hoje"
      >
        {sorted.map((dose) => (
          <CronogramaDoseItem
            key={`${dose.protocolId}-${dose.scheduledTime}`}
            dose={dose}
            onRegister={onRegister}
            stockDays={dose.stockDays}
            stockStatus={dose.stockStatus}
            now={now}
          />
        ))}
      </div>
    )
  }

  // ── MODO COMPLEX: 4 zonas com accordion ──
  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
      aria-label="Cronograma de doses de hoje"
      variants={cascade.container}
      initial="hidden"
      animate="visible"
    >
      {grouped.map(({ id, label, Icon, doses, isPast, isCurrent }) => {
        const PeriodIcon = Icon
        const isOpen = openZones[id] ?? !isPast
        const isEmpty = doses.length === 0
        // Passado com conteúdo → verde apagado; passado vazio → cinza esmaecido
        const isPastActive = isPast && !isEmpty
        const isPastEmpty = isPast && isEmpty
        const doneCount = doses.filter((d) => d.isRegistered).length
        const missedCount = isPast ? doses.filter((d) => !d.isRegistered).length : 0

        return (
          <motion.section
            key={id}
            aria-label={`${label}: ${doses.length} dose${doses.length !== 1 ? 's' : ''}`}
            variants={cascade.item}
          >
            {/* Header accordion */}
            <button
              className={[
                'cronograma-period-header',
                isPastActive ? 'cronograma-period-header--past-active' : '',
                isPastEmpty ? 'cronograma-period-header--past' : '',
                isCurrent ? 'cronograma-period-header--current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setOpenZones((prev) => ({ ...prev, [id]: !prev[id] }))}
              aria-expanded={isOpen}
            >
              <PeriodIcon
                size={16}
                color={
                  isPastActive
                    ? 'var(--color-primary, #006a5e)'
                    : isPastEmpty
                      ? 'var(--color-outline-variant, #bec9c5)'
                      : 'var(--color-outline, #6d7a76)'
                }
                aria-hidden="true"
              />
              <span className="cronograma-period-header__label">{label}</span>

              <div className="cronograma-period-header__right">
                {isEmpty ? (
                  <span className="cronograma-period-header__empty-tag">Vazio</span>
                ) : isPast ? (
                  missedCount > 0 ? (
                    <span className="cronograma-period-header__missed-count">
                      {missedCount} perdida{missedCount !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <>
                      <span className="cronograma-period-header__done-tag">· Concluído</span>
                      <CheckCircle2
                        size={14}
                        color="var(--color-primary, #006a5e)"
                        aria-hidden="true"
                      />
                    </>
                  )
                ) : (
                  <span className="cronograma-period-header__count">
                    {doneCount}/{doses.length}
                  </span>
                )}
                <ChevronRight
                  size={16}
                  className={`cronograma-period-header__chevron ${isOpen ? 'cronograma-period-header__chevron--open' : ''}`}
                  aria-hidden="true"
                />
              </div>
            </button>

            {/* Conteúdo: empty state ou lista de doses */}
            {isOpen &&
              (isEmpty ? (
                <div className="cronograma-period-empty" role="status">
                  <Circle
                    size={18}
                    color="var(--color-outline-variant, #bec9c5)"
                    aria-hidden="true"
                  />
                  <p className="cronograma-period-empty__text">
                    Nenhum medicamento para este período
                  </p>
                </div>
              ) : (
                <div className="cronograma-doses">
                  {doses.map((dose) => (
                    <CronogramaDoseItem
                      key={`${dose.protocolId}-${dose.scheduledTime}`}
                      dose={dose}
                      onRegister={onRegister}
                      stockDays={dose.stockDays}
                      stockStatus={dose.stockStatus}
                      now={now}
                    />
                  ))}
                </div>
              ))}
          </motion.section>
        )
      })}
    </motion.div>
  )
}
