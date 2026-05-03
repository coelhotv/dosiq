import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { parseLocalDate, getTodayLocal } from '@utils/dateUtils'
import { PRESCRIPTION_STATUS } from '@features/prescriptions/services/prescriptionService'
import './PrescriptionTimeline.css'

/** Cor da barra por status de prescrição */
const STATUS_COLOR = {
  [PRESCRIPTION_STATUS.VIGENTE]: 'var(--color-success)',
  [PRESCRIPTION_STATUS.VENCENDO]: 'var(--color-warning)',
  [PRESCRIPTION_STATUS.VENCIDA]: 'var(--color-error)',
}

/**
 * Formata YYYY-MM-DD para DD/MM/YYYY sem usar new Date() (evita UTC timezone R-020).
 */
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

/**
 * Calcula posição de "hoje" como percentual entre start e end (0–100).
 * Retorna null para prescrições contínuas (sem end_date).
 */
function calcTodayPercent(startDate, endDate) {
  if (!endDate) return null
  const start = parseLocalDate(startDate).getTime()
  const end = parseLocalDate(endDate).getTime()
  const today = parseLocalDate(getTodayLocal()).getTime()
  const total = end - start
  if (total <= 0) return 100
  return Math.min(Math.max(((today - start) / total) * 100, 0), 100)
}

/**
 * PrescriptionTimeline — barra visual de vigência de prescrição (W1-07)
 *
 * Componente puro da Onda 1: recebe dados apenas por props.
 * A posição do marcador "hoje" é derivada de startDate/endDate.
 *
 * @param {Object} props
 * @param {string} props.name - Nome do protocolo/medicamento
 * @param {string} props.startDate - Início da prescrição (YYYY-MM-DD)
 * @param {string|null} props.endDate - Fim da prescrição ou null (contínuo)
 * @param {'vigente'|'vencendo'|'vencida'} props.status - Status calculado pelo prescriptionService
 * @param {number|null} props.daysRemaining - Dias restantes (negativo se vencida, null se contínuo)
 * @param {Function} [props.onPress] - Callback ao tocar — navega para protocolo
 * @param {string} [props.className]
 */
export default function PrescriptionTimeline({
  name,
  startDate,
  endDate,
  status,
  daysRemaining,
  onPress,
  className = '',
}) {
  const color = STATUS_COLOR[status] ?? 'var(--color-info)'
  const isExpired = status === PRESCRIPTION_STATUS.VENCIDA
  const isContinuous = !endDate

  const todayPercent = useMemo(() => calcTodayPercent(startDate, endDate), [startDate, endDate])
  const filledWidth = useMemo(() => (isContinuous ? 100 : (todayPercent ?? 100)), [isContinuous, todayPercent])
  
  const { showTodayMarker, showFutureSegment } = useMemo(() => {
    const todayMarker = !isContinuous && todayPercent !== null && todayPercent > 0 && todayPercent < 100
    const futureSegment = !isContinuous && !isExpired && todayPercent !== null && todayPercent < 100
    return { showTodayMarker: todayMarker, showFutureSegment: futureSegment }
  }, [isContinuous, todayPercent, isExpired])

  // Label do badge de status
  let badgeLabel
  if (isContinuous) {
    badgeLabel = 'Contínuo'
  } else if (daysRemaining === null) {
    badgeLabel = status
  } else if (daysRemaining >= 0) {
    badgeLabel = `${daysRemaining}d restantes`
  } else {
    badgeLabel = `Vencida há ${Math.abs(daysRemaining)}d`
  }

  const handleKeyDown = (e) => {
    if (onPress && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onPress()
    }
  }

  const rootClass = [
    'prescription-timeline',
    isExpired ? 'prescription-timeline--expired pulse-critical' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const Tag = onPress ? 'button' : 'div'

  return (
    <Tag
      className={rootClass}
      onClick={onPress}
      onKeyDown={handleKeyDown}
      aria-label={`Prescrição ${name}: ${badgeLabel}`}
      data-testid="prescription-timeline"
    >
      {/* Cabeçalho: nome + badge */}
      <div className="prescription-timeline__header">
        <span className="prescription-timeline__name">{name}</span>
        <span className="prescription-timeline__badge" style={{ color }} data-status={status}>
          {badgeLabel}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="prescription-timeline__track" aria-hidden="true">
        {/* Segmento preenchido — passado até hoje */}
        <motion.div
          className="prescription-timeline__fill"
          style={{ '--timeline-color': color }}
          initial={{ width: 0 }}
          animate={{ width: `${filledWidth}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {/* Segmento futuro (outline) */}
        {showFutureSegment && (
          <div
            className="prescription-timeline__future"
            style={{
              '--timeline-color': color,
              left: `${filledWidth}%`,
              width: `${100 - filledWidth}%`,
            }}
          />
        )}

        {/* Marcador "hoje" */}
        {showTodayMarker && (
          <div
            className="prescription-timeline__today-marker"
            style={{ left: `${todayPercent}%` }}
          />
        )}
      </div>

      {/* Labels de data */}
      <div className="prescription-timeline__dates">
        <span className="prescription-timeline__date">{formatDate(startDate)}</span>
        <span className="prescription-timeline__date prescription-timeline__date--end">
          {isContinuous ? 'Sem vencimento' : formatDate(endDate)}
        </span>
      </div>
    </Tag>
  )
}
