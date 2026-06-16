// MeasuresHub.jsx — Tendência de Medidas no web (012 Fase C · FR-011b). Embutida na HealthHistory.
// v1: chips de tipo (glicemia/peso) + tendência scatter 7d (WeekNav, média descritiva). O histórico
// cronológico + editar/excluir vivem nas listagens de cada dia (HistoryDayPanel) — não duplicado aqui.
// O registro de medida usa o speed-dial global (FAB) — sem botão próprio. SaMD (ADR-062): sem
// zona/meta/linha; cor diferencia tipo, nunca qualidade.

import { useState } from 'react'
import { BIOMARKER_TYPE_LABELS, BIOMARKER_TYPE_UNITS, biomarkerCardLabel } from '@dosiq/core'
import { useMeasures } from '@features/measures/hooks/useMeasures'
import ScatterTrend from './ScatterTrend'
import './MeasuresHub.css'

const HUB_TYPES = ['glicemia', 'peso', 'pressao_arterial']

export default function MeasuresHub({ initialType = 'glicemia' }) {
  const [type, setType] = useState(initialType)
  const { items, error } = useMeasures({ type })

  return (
    <div className="mhub">
      <div className="mhub__header">
        <h3 className="hhr-section-title">Tendência de Medidas</h3>
      </div>

      {/* Chips de tipo — sem ícone (handoff: IconRuler é a marca única de medida) */}
      <div className="mhub__chips">
        {HUB_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`mhub__chip${type === t ? ' mhub__chip--active' : ''}`}
            aria-pressed={type === t}
          >
            {BIOMARKER_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <div className="hhr-banner hhr-banner--error">{error}</div>}

      <ScatterTrend items={items} unit={BIOMARKER_TYPE_UNITS[type]} typeLabel={biomarkerCardLabel(type)} isPa={type === 'pressao_arterial'} />
    </div>
  )
}
