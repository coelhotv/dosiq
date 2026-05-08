import { AnimatePresence, motion } from 'framer-motion'
import SparklineAdesao from './SparklineAdesao'
import './RingGauge.css'

// Raio do ring SVG (viewBox 0 0 120 120, centro em 60,60)
const RADIUS = 46

function getRingColor(score) {
  if (score < 50) return 'var(--color-error)'
  if (score < 70) return 'var(--color-warning)'
  if (score < 85) return 'var(--color-success)'
  return 'var(--color-info)'
}

function getMotivationMessage(score) {
  if (score === 100) return 'Perfeito!'
  if (score >= 85) return 'Muito Bom!'
  if (score >= 70) return 'Bom trabalho!'
  if (score >= 50) return 'Continue assim!'
  return 'Vamos melhorar!'
}

function getStreakIcon(streak) {
  if (streak >= 30) return '🏆'
  if (streak >= 14) return '🔥'
  if (streak >= 7) return '⚡'
  return '🔥'
}

function _getSvgSize(size) {
  if (size === 'large') return 120
  if (size === 'compact') return 56
  return 80
}

/**
 * RingGauge — Ring gauge circular animado com score de adesão.
 *
 * Componente puro: dados exclusivamente por props (sem context/hooks externos).
 *
 * @param {number} score - 0–100, porcentagem de adesão
 * @param {number} streak - Dias consecutivos
 * @param {'compact'|'medium'|'large'} [size] - Default: 'medium'
 * @param {Function} [onClick] - Click handler (abre HealthScoreDetails)
 * @param {Array} [sparklineData] - 7 pontos {date, adherence} para sparkline inline
 * @param {string} [className] - CSS override
 */
export default function RingGauge({
  score = 0,
  streak = 0,
  size = 'medium',
  onClick,
  sparklineData = [],
  className = '',
}) {
  const circumference = 2 * Math.PI * RADIUS
  const offset = circumference - (score / 100) * circumference
  const ringColor = getRingColor(score)
  const isClickable = Boolean(onClick)
  const svgSize = _getSvgSize(size)

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const ringTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 60, damping: 15 }
  const streakTransition = prefersReducedMotion ? { duration: 0 } : { delay: 0.3, duration: 0.4 }

  const ringElement = (
    <svg
      viewBox="0 0 120 120"
      width={svgSize}
      height={svgSize}
      role="img"
      aria-label={`Adesão: ${score}%. Streak: ${streak} dias`}
      className="ring-gauge__svg"
    >
      {/* Ring de fundo */}
      <circle
        cx="60"
        cy="60"
        r={RADIUS}
        stroke="var(--color-border, #e5e7eb)"
        strokeWidth="8"
        fill="none"
      />
      {/* Ring de progresso */}
      <motion.circle
        cx="60"
        cy="60"
        r={RADIUS}
        stroke={ringColor}
        strokeWidth="8"
        fill="none"
        strokeDasharray={circumference}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={ringTransition}
        style={{ strokeDashoffset: offset }}
      />
      {/* Score central */}
      <text x="60" y="54" textAnchor="middle" className="ring-gauge__score">
        {score}
      </text>
      <text x="60" y="70" textAnchor="middle" className="ring-gauge__label">
        %
      </text>
    </svg>
  )

  const streakBadge = (
    <motion.div
      className="ring-gauge__streak"
      initial={{ scale: 0 }}
      animate={{ scale: [0, 1.15, 1] }}
      transition={streakTransition}
    >
      <span className="ring-gauge__streak-icon">{getStreakIcon(streak)}</span>
      <span className="ring-gauge__streak-value">{streak}d</span>
    </motion.div>
  )

  const Tag = isClickable ? 'button' : 'div'
  const sharedProps = {
    className: `ring-gauge ring-gauge--${size} ${isClickable ? 'ring-gauge--clickable' : ''} ${className}`,
    onClick,
    type: isClickable ? 'button' : undefined,
    tabIndex: isClickable ? 0 : undefined,
  }

  if (size === 'large') {
    return (
      <Tag {...sharedProps}>
        <div className="ring-gauge__ring-wrapper">{ringElement}</div>
        <div className="ring-gauge__info">
          <AnimatePresence mode="wait">
            <motion.p
              key={score}
              className="ring-gauge__motivation"
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {getMotivationMessage(score)}
            </motion.p>
          </AnimatePresence>
          {streakBadge}
          {sparklineData.length > 0 && (
            <div className="ring-gauge__sparkline">
              <SparklineAdesao adherenceByDay={sparklineData} size="small" />
            </div>
          )}
        </div>
      </Tag>
    )
  }

  if (size === 'medium') {
    return (
      <Tag {...sharedProps}>
        {ringElement}
        <div className="ring-gauge__medium-content">
          <div className="ring-gauge__medium-top">
            <span className="ring-gauge__score-text">{score}%</span>
            {streakBadge}
          </div>
          {sparklineData.length > 0 && (
            <SparklineAdesao adherenceByDay={sparklineData} size="inline" />
          )}
        </div>
      </Tag>
    )
  }

  return (
    <Tag {...sharedProps}>
      {ringElement}
      <span className="ring-gauge__score-text">{score}%</span>
      {streakBadge}
    </Tag>
  )
}
