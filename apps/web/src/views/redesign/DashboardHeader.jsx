import RingGaugeRedesign from '@dashboard/components/RingGaugeRedesign'

export default function DashboardHeader({ userName, adherenceScore, remainingDoses, streak, getMotivationalMessage }) {
  return (
    <div className="dr-badge">
      <div className="dr-badge__text">
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display, Public Sans, sans-serif)',
            fontSize: 'var(--text-headline-md, 1.75rem)',
            fontWeight: '700',
            color: 'var(--color-on-surface)',
            lineHeight: 1.2,
          }}
        >
          {userName ? `Olá, ${userName} 👋` : 'Olá! 👋'}
        </h1>

        <p
          style={{
            margin: '0.25rem 0 0',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-label-md, 0.75rem)',
            color: 'var(--color-outline)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: '600',
          }}
        >
          ADESÃO DIÁRIA
        </p>

        <p
          style={{
            margin: '0.5rem 0 0',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-body-lg, 1rem)',
            color: 'var(--color-on-surface-variant)',
          }}
        >
          {getMotivationalMessage(adherenceScore, remainingDoses)}
        </p>
      </div>

      <RingGaugeRedesign score={adherenceScore} streak={streak} size="large" />
    </div>
  )
}
