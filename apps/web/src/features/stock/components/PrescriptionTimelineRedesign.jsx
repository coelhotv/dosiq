/**
 * PrescriptionTimelineRedesign — Visualização de vigência de prescrições com timeline
 * Renderiza prescrições com data de fim, filtrando prescrições contínuas (Wave 15.6)
 */

import { parseLocalDate, getNow, daysDifference } from '@utils/dateUtils'
import './PrescriptionTimelineRedesign.css'

function deriveProgress(startDate, endDate) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  const today = getNow()
  const totalDays = Math.max((end - start) / 86400000, 1)
  const elapsed = (today - start) / 86400000
  return Math.min(Math.max((elapsed / totalDays) * 100, 0), 100)
}

function getDaysRemaining(endDateStr) {
  if (!endDateStr) return null
  const end = parseLocalDate(endDateStr)
  const today = getNow()
  
  // Usar helper centralizado para evitar timezone drift
  return daysDifference(today, end)
}

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const STATUS_LABELS = {
  ativa: 'Ativa',
  vencendo: 'Vencendo',
  vencida: 'Vencida',
  finalizada: 'Finalizada',
}

export default function PrescriptionTimelineRedesign({ prescriptions, isComplex }) {
  const timedPrescriptions = prescriptions.filter((p) => p.endDate != null && !p.isContinuous)
  if (timedPrescriptions.length === 0) return null

  return (
    <section className="prescription-timeline-redesign" aria-label="Vigência de prescrições">
      <h3 className="prescription-timeline-redesign__title">
        {isComplex ? 'Vigência das Prescrições' : 'Prescrições'}
      </h3>

      {isComplex && (
        <div className="prescription-timeline-redesign__summary">
          {['ativa', 'vencendo', 'vencida'].map((s) => {
            const count = timedPrescriptions.filter((p) => p.status === s).length
            return count > 0 ? (
              <span key={s} className={`prx-status prx-status--${s}`}>
                {count} {STATUS_LABELS[s].toLowerCase()}
                {count > 1 ? 's' : ''}
              </span>
            ) : null
          })}
        </div>
      )}

      <div className="prescription-timeline-redesign__list">
        {timedPrescriptions.map((p) => {
          const progress = deriveProgress(p.startDate, p.endDate)
          const daysLeft = getDaysRemaining(p.endDate)
          const daysLabel =
            daysLeft == null
              ? ''
              : daysLeft < 0
                ? 'Vencida'
                : daysLeft === 0
                  ? 'Vence hoje'
                  : `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`
          return (
            <div key={p.id} className="prescription-timeline-redesign__item">
              <div className="prescription-timeline-redesign__item-header">
                <span className="prescription-timeline-redesign__name">{p.medicineName}</span>
                <span className={`prx-status prx-status--${p.status}`}>
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
              <div className="prescription-timeline-redesign__bar-track">
                <div
                  className={`prescription-timeline-redesign__bar-fill prescription-timeline-redesign__bar-fill--${p.status}`}
                  style={{ '--progress': `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${p.medicineName}: ${Math.round(progress)}% da vigência`}
                />
              </div>
              <div className="prescription-timeline-redesign__bar-footer">
                <span className="prescription-timeline-redesign__dates-label">
                  {formatShortDate(p.startDate)} → {formatShortDate(p.endDate)}
                </span>
                <span className={`prescription-timeline-redesign__days-left prx-days--${p.status}`}>
                  {daysLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
