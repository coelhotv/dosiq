import { motion } from 'framer-motion'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const SIZE_MAP = {
  large: { svgSize: 120, strokeWidth: 12, fontSize: '1.75rem', labelSize: '0.625rem' },
  medium: { svgSize: 96, strokeWidth: 10, fontSize: '1.25rem', labelSize: '0.6rem' },
  compact: { svgSize: 56, strokeWidth: 8, fontSize: '0.875rem', labelSize: '0.5rem' },
}

export default function RingGaugeRedesign({
  score = 0,
  streak = 0,
  size = 'medium',
  onClick,
  className = '',
}) {
  const { svgSize, strokeWidth, fontSize, labelSize } = SIZE_MAP[size] || SIZE_MAP.medium
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE
  const isClickable = Boolean(onClick)

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      className={`ring-gauge-redesign ring-gauge-redesign--${size}${className ? ` ${className}` : ''}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }
      aria-label={`Adesão diária: ${score}%. Streak: ${streak} dias`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: isClickable ? 'pointer' : 'default',
      }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 120 120"
        role="img"
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        {/* Track */}
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="var(--color-secondary, #005db6)"
          strokeWidth={strokeWidth}
          opacity="0.2"
        />
        {/* Progress */}
        <motion.circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="var(--color-primary-fixed, #90f4e3)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 1, delay: 0.5, ease: [0.4, 0, 0.2, 1] }
          }
          style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
        />
        {/* Percentagem */}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-on-surface, #191c1d)"
          fontFamily="var(--font-display, 'Public Sans', sans-serif)"
          fontWeight="700"
          fontSize={fontSize}
        >
          {score}%
        </text>
        {/* Label */}
        <text
          x="60"
          y="72"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-outline, #6d7a76)"
          fontFamily="var(--font-body, 'Lexend', sans-serif)"
          fontWeight="500"
          fontSize={labelSize}
        >
          ADESÃO
        </text>
      </svg>

      {/* Streak */}
      {streak > 0 && (
        <div
          aria-label={`Streak: ${streak} dias consecutivos`}
          style={{
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-label-md, 0.75rem)',
            fontWeight: 'var(--font-weight-medium, 500)',
            color: 'var(--color-tertiary, #7b5700)',
          }}
        >
          🔥 {streak} dias
        </div>
      )}
    </div>
  )
}
