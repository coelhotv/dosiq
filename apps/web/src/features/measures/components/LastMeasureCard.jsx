// LastMeasureCard.jsx — card "Última medida" no fim da agenda do Dashboard (012 Fase C / FR-011).
// Acompanha o conceito da timeline do dia: reflete a última medida de HOJE; sem medida hoje →
// nudge "Nenhuma medida hoje. Registre a primeira →" (abre fast-log). Espelha o card mobile.
// SaMD (ADR-062): sem cor/copy de qualidade. Tap leva ao histórico do tipo correto (deeplink).

import { Ruler, ChevronRight, Plus } from 'lucide-react'
import { BIOMARKER_TYPE_LABELS, formatTimePtBR } from '@dosiq/core'
import './LastMeasureCard.css'

function formatMeasure(m) {
  const v = String(m.value).replace('.', ',')
  if (m.value_secondary != null) return `${v}/${String(m.value_secondary).replace('.', ',')} ${m.unit}`
  return `${v} ${m.unit}`
}

/**
 * @param {Object} props
 * @param {Object|null} props.measure - última medida de hoje (ou null).
 * @param {Function} props.onOpenHistory - callback(type) → abre histórico do tipo.
 * @param {Function} props.onRegister - callback() → abre fast-log (estado vazio).
 */
export default function LastMeasureCard({ measure, onOpenHistory, onRegister }) {
  if (!measure) {
    return (
      <button type="button" className="lmc-nudge" onClick={onRegister}>
        <span className="lmc-nudge__icon"><Plus size={18} aria-hidden="true" /></span>
        <span className="lmc-nudge__text">Nenhuma medida hoje. Registre a primeira</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    )
  }

  const label = BIOMARKER_TYPE_LABELS[measure.type] || measure.type
  return (
    <button type="button" className="lmc-card" onClick={() => onOpenHistory?.(measure.type)}>
      <span className="lmc-card__icon"><Ruler size={18} aria-hidden="true" /></span>
      <span className="lmc-card__body">
        <span className="lmc-card__value">{label}: {formatMeasure(measure)}</span>
        <span className="lmc-card__time">Última medida · {formatTimePtBR(measure.measured_at)}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  )
}
