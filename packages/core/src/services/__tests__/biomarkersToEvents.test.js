import { describe, it, expect } from 'vitest'
import { biomarkersToEvents } from '../timelineService.js'
import { TIMELINE_EVENT_TYPES, buildTimeline } from '../../utils/timeline.js'

// 012 Fase C — adapter biomarkersToEvents (ADR-060 / R-252). Puro, sem tocar builder.

const sample = (over = {}) => ({
  id: 'b1', type: 'glicemia', value: 110, value_secondary: null,
  unit: 'mg/dL', measured_at: '2026-06-14T09:00:00Z', context: 'jejum', notes: null, ...over,
})

describe('biomarkersToEvents', () => {
  it('lista vazia → []', () => {
    expect(biomarkersToEvents([])).toEqual([])
    expect(biomarkersToEvents(null)).toEqual([])
  })

  it('mapeia para TimelineEvent type=biomarker', () => {
    const [ev] = biomarkersToEvents([sample()])
    expect(ev.type).toBe(TIMELINE_EVENT_TYPES.BIOMARKER)
    expect(ev.id).toBe('bio:b1')
    expect(ev.occurred_at).toBe('2026-06-14T09:00:00Z')
    expect(ev.payload.value).toBe(110)
    expect(ev.payload.biomarkerType).toBe('glicemia')
  })

  it('measured_at ausente → descartado (não ordena NaN)', () => {
    expect(biomarkersToEvents([sample({ measured_at: null })])).toEqual([])
  })

  it('PA carrega value_secondary no payload', () => {
    const [ev] = biomarkersToEvents([sample({ type: 'pressao_arterial', value: 120, value_secondary: 80, unit: 'mmHg' })])
    expect(ev.payload.valueSecondary).toBe(80)
  })

  it('entra no builder ordenado por instante (sem tocar builder)', () => {
    const events = biomarkersToEvents([
      sample({ id: 'a', measured_at: '2026-06-14T08:00:00Z' }),
      sample({ id: 'b', measured_at: '2026-06-14T10:00:00Z' }),
    ])
    const stream = buildTimeline(events, { tz: 'America/Sao_Paulo', order: 'asc' })
    expect(stream.map((e) => e.id)).toEqual(['bio:a', 'bio:b'])
  })
})
