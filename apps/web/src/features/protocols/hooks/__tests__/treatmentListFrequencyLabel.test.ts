/**
 * 085 C2 — rótulo de frequência da lista de tratamentos (ProtocolRowCard/Tabular).
 * Esta tela tem mapa PRÓPRIO ("Dias alternados", sentença) — a cadência nova troca só o seu ramo.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { transformProtocolToItem } from '../_treatmentListUtils'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const base = {
  id: 'p1',
  medicine_id: 'm1',
  medicine: { id: 'm1', name: 'Depo', dosage_per_pill: 150, dosage_unit: 'mg' },
  time_schedule: ['09:00'],
  dosage_per_intake: 1,
  active: true,
  start_date: '2026-09-01',
  weekdays: [],
}

describe('transformProtocolToItem — frequencyLabel (085 C2)', () => {
  it('intervalo_dias com N ⇒ "A cada 90 dias"', () => {
    const item = transformProtocolToItem({ ...base, frequency: 'intervalo_dias', interval_days: 90 }, {}, {})
    expect(item.frequencyLabel).toBe('A cada 90 dias')
  })

  it('guard T042: as frequências antigas mantêm o texto desta tela', () => {
    const cases = {
      diário: 'Diário',
      dias_alternados: 'Dias alternados',
      quando_necessário: 'Quando necessário',
    }
    for (const [frequency, label] of Object.entries(cases)) {
      expect(transformProtocolToItem({ ...base, frequency }, {}, {}).frequencyLabel).toBe(label)
    }
  })
})
