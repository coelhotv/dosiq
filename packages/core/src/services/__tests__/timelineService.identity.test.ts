import { describe, it, expect, afterEach, vi } from 'vitest'
import { doseInstancesToEvents } from '../timelineService'

describe('timelineService — precedência de identidade (052)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  const protocolsById = {
    p1: { medicine_id: 'm2', medicine: { id: 'm2', name: 'Mounjaro 15', dosage_unit: 'mg' } },
    p0: { medicine_id: 'm1', medicine: { id: 'm1', name: 'Mounjaro 2,5', dosage_unit: 'mg' } },
  }

  it('dose passada usa o congelado, não o medicamento atual do protocolo', () => {
    const [ev] = doseInstancesToEvents(
      [{ id: 'i1', status: 'missed', protocol_id: 'p1', medicine_id: 'm1', scheduled_for: '2026-06-07T11:00:00Z' }],
      [],
      { protocolsById }
    )
    expect(ev.payload.medicineId).toBe('m1')
    expect(ev.payload.medicineName).toBe('Mounjaro 2,5')
  })

  it('log ancorado tem precedência sobre o congelado (foi o que realmente aconteceu)', () => {
    const [ev] = doseInstancesToEvents(
      [{ id: 'i1', status: 'taken', protocol_id: 'p1', medicine_id: 'm1', scheduled_for: '2026-06-07T11:00:00Z', medicine_log_id: 'l1' }],
      [{ id: 'l1', protocol_id: 'p1', medicine_id: 'm9', taken_at: '2026-06-07T11:05:00Z' }],
      { protocolsById }
    )
    expect(ev.payload.medicineId).toBe('m9')
  })
})
