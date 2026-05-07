import { 
  Pill, 
  PillBottle, 
  CircleCheckBig, 
  CircleAlert 
} from 'lucide-react'
import { DOSE_REGISTRATION_TOLERANCE_MS } from '@dashboard/hooks/useDoseZones'

const LATE_WINDOW_MINUTES = DOSE_REGISTRATION_TOLERANCE_MS / 60_000

function getMinutesDiff(scheduledTime, now) {
  const [h, m] = scheduledTime.split(':').map(Number)
  const scheduledMinutes = h * 60 + m
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes - scheduledMinutes
}

function getDoseStatus(dose, now) {
  if (dose.isRegistered) return 'done'
  const diff = getMinutesDiff(dose.scheduledTime, now)
  return diff > LATE_WINDOW_MINUTES ? 'missed' : 'pending'
}

function isWithinActionWindow(dose, now) {
  const diff = getMinutesDiff(dose.scheduledTime, now)
  return Math.abs(diff) <= LATE_WINDOW_MINUTES
}

export default function CronogramaDoseItem({ dose, onRegister, stockDays, stockStatus, now }) {
  const status = getDoseStatus(dose, now)
  const canTake = status === 'pending' && isWithinActionWindow(dose, now)
  const done = status === 'done'
  const missed = status === 'missed'
  const showStockBadge = !missed && (stockStatus === 'critical' || stockStatus === 'low')
  const isSupplement = dose.medicineType === 'suplemento'
  const MedicineIcon = isSupplement ? PillBottle : Pill

  return (
    <div className={`cronograma-dose-card cronograma-dose-card--${status}`}>
      {done && (
        <CircleCheckBig
          size={18}
          className="cronograma-dose-card__status-icon"
          color="var(--color-primary)"
          aria-label="Dose registrada"
        />
      )}
      {missed && (
        <CircleAlert
          size={18}
          className="cronograma-dose-card__status-icon"
          color="var(--color-warning)"
          aria-label="Dose perdida"
        />
      )}

      <div className={`cronograma-dose-card__icon-wrap cronograma-dose-card__icon-wrap--${isSupplement ? 'supplement' : 'medicine'}`}>
        <MedicineIcon size={20} color="var(--color-white)" aria-hidden="true" />
      </div>

      <div className="cronograma-dose-card__main">
        <div className="cronograma-dose-card__details">
          <div className="cronograma-dose-card__name-row">
            <span className="cronograma-dose-card__title">{dose.medicineName}</span>
            {dose.dosagePerPill && dose.dosageUnit && (
              <span className="cronograma-dose-card__strength">
                {dose.dosagePerPill}{dose.dosageUnit}
              </span>
            )}
          </div>
          <div className="cronograma-dose-card__intake-row">
            <span className="cronograma-dose-card__intake">
              {dose.dosagePerIntake} comprimido{dose.dosagePerIntake !== 1 ? 's' : ''}
            </span>
            {showStockBadge && (
              <span className={`cronograma-dose-card__stock-badge cronograma-dose-card__stock-badge--${stockStatus}`}>
                {stockStatus === 'critical' ? 'Crítico' : 'Baixo'}
                {stockDays !== null ? ` ${stockDays}d` : ''}
              </span>
            )}
          </div>
        </div>

        <time className="cronograma-dose-card__time" dateTime={dose.scheduledTime}>
          {dose.scheduledTime}
        </time>
      </div>

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
