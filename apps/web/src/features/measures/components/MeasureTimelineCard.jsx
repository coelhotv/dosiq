// MeasureTimelineCard.jsx — card de medida na Agenda de Hoje (012 Fase C / FR-011).
// Interleave temporal com as doses: reusa a casca .cronograma-dose-card (herda densidade
// simple 1col / complex 2col do container), com tinta de "registro" (não elevação — AP-018).
// SaMD (ADR-062): cor diferencia TIPO, nunca qualidade. Read-only (registro já ocorrido).

import { Ruler } from 'lucide-react'
import { BIOMARKER_TYPE_LABELS, BIOMARKER_CONTEXT_LABELS } from '@dosiq/core'

function formatMeasure(m) {
  const v = String(m.value).replace('.', ',')
  if (m.value_secondary != null) return `${v}/${String(m.value_secondary).replace('.', ',')} ${m.unit}`
  return `${v} ${m.unit}`
}

/**
 * @param {Object} props
 * @param {Object} props.measure - linha de biomarkers_log.
 * @param {string} props.scheduledTime - HH:MM local (já derivado pelo container, p/ exibição).
 */
export default function MeasureTimelineCard({ measure, scheduledTime }) {
  const label = BIOMARKER_TYPE_LABELS[measure.type] || measure.type
  const ctx = measure.context ? BIOMARKER_CONTEXT_LABELS[measure.context] : null

  return (
    <div className="cronograma-dose-card cronograma-dose-card--measure">
      <div className="cronograma-dose-card__icon-wrap cronograma-dose-card__icon-wrap--measure">
        <Ruler size={18} color="var(--color-info, #0288d1)" aria-hidden="true" />
      </div>

      <div className="cronograma-dose-card__main">
        <div className="cronograma-dose-card__details">
          <div className="cronograma-dose-card__name-row">
            <span className="cronograma-dose-card__title">{label} {formatMeasure(measure)}</span>
          </div>
          {ctx && (
            <div className="cronograma-dose-card__intake-row">
              <span className="cronograma-dose-card__intake">{ctx}</span>
            </div>
          )}
        </div>

        <time className="cronograma-dose-card__time" dateTime={scheduledTime}>{scheduledTime}</time>
      </div>
    </div>
  )
}
