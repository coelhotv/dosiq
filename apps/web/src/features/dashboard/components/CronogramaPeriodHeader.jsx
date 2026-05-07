import { ChevronRight, CheckCircle2 } from 'lucide-react'

export default function CronogramaPeriodHeader({ 
  label, 
  Icon, 
  isOpen, 
  isEmpty, 
  isPast, 
  isPastActive, 
  isPastEmpty, 
  isCurrent, 
  missedCount, 
  doneCount, 
  totalDoses, 
  onToggle 
}) {
  const PeriodIcon = Icon
  
  return (
    <button
      className={[
        'cronograma-period-header',
        isPastActive ? 'cronograma-period-header--past-active' : '',
        isPastEmpty ? 'cronograma-period-header--past' : '',
        isCurrent ? 'cronograma-period-header--current' : '',
      ].filter(Boolean).join(' ')}
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      <PeriodIcon
        size={16}
        color={
          isPastActive
            ? 'var(--color-primary)'
            : isPastEmpty
              ? 'var(--color-outline-variant)'
              : 'var(--color-outline)'
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
                color="var(--color-primary)"
                aria-hidden="true"
              />
            </>
          )
        ) : (
          <span className="cronograma-period-header__count">
            {doneCount}/{totalDoses}
          </span>
        )}
        <ChevronRight
          size={16}
          className={`cronograma-period-header__chevron ${isOpen ? 'cronograma-period-header__chevron--open' : ''}`}
          aria-hidden="true"
        />
      </div>
    </button>
  )
}
