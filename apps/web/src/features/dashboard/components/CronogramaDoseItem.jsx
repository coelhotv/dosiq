import {
  CircleCheckBig,
  CircleAlert
} from 'lucide-react'
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import { classifyDose } from '@dashboard/hooks/useDoseZones'

import { formatDoseItem, formatConcentration, daysAgoLabel } from '@dosiq/core'

/**
 * Status do card a partir do instante ABSOLUTO da ocorrência + sua tolerância
 * dinâmica (`dose.toleranceMinutes`), reusando `classifyDose` (fonte única).
 * `now` é o instante absoluto (nowRaw), não o wall-clock shiftado — evita o bug
 * cross-meia-noite e respeita a metade-do-gap entre doses adjacentes.
 */
export default function CronogramaDoseItem({ dose, onRegister, stockDays, stockStatus, now }) {
  const zone = classifyDose(
    dose.scheduledFor,
    now,
    120,
    60,
    240,
    dose.isRegistered,
    dose.toleranceMinutes
  )
  const done = zone === 'done'
  const missed = zone === null // passou da tolerância → perdida
  const status = done ? 'done' : missed ? 'missed' : 'pending'
  // Actionável: atrasada (dentro da tolerância), agora, ou em breve (não "mais tarde").
  const canTake = !done && !missed && (zone === 'late' || zone === 'now' || zone === 'upcoming')
  const showStockBadge = !missed && (stockStatus === 'critical' || stockStatus === 'low')
  const isSupplement = dose.medicineType === 'suplemento'

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
        <MedicineIcon
          medicine={{ type: dose.medicineType, presentation: dose.presentation, dosage_unit: dose.dosageUnit }}
          size={20}
          color="var(--color-white)"
          aria-hidden="true"
        />
      </div>

      <div className="cronograma-dose-card__main">
        <div className="cronograma-dose-card__details">
          <div className="cronograma-dose-card__name-row">
            <span className="cronograma-dose-card__title">{dose.medicineName}</span>
            {dose.dosagePerPill && dose.dosageUnit && (
              <span className="cronograma-dose-card__strength">
                {formatConcentration(dose.dosagePerPill, dose.dosageUnit)}
              </span>
            )}
          </div>
          <div className="cronograma-dose-card__intake-row">
            <span className="cronograma-dose-card__intake">
              {formatDoseItem(dose)}
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
          {/* 012 Fase B (FR-008b): dose semanal pendente multi-dia ganha rótulo
              relativo — "10:00" sozinho mentiria o dia da dose carregada. */}
          {(() => {
            const ago = !done && now ? daysAgoLabel(dose.scheduledFor, now) : null
            return ago ? `${ago} · ${dose.scheduledTime}` : dose.scheduledTime
          })()}
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
