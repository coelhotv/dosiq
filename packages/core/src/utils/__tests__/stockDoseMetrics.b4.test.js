import { describe, it, expect } from 'vitest'
import { stockDoseMetrics } from '../stock.js'

// 012 Fase B4 / ADR-067 — modelo dose-primário.
// Número exibido = total de doses físicas; cor = runwayDias (derivado).
describe('stockDoseMetrics (B4 — dose-primário)', () => {
  it('Mounjaro semanal 1x 0,5 ml, estoque 2 ml → 4 doses / runway 28 dias', () => {
    const medicine = { dosage_unit: 'mg/ml', units_per_ml: 5, dosage_per_pill: 5 }
    const protocols = [
      { medicine_id: 'm1', active: true, time_schedule: ['08:00'], dosage_per_intake: 0.5, intake_unit: 'ml', frequency: 'semanal' },
    ]
    const r = stockDoseMetrics(2, protocols, medicine)
    expect(r.dosesRemaining).toBe(4)        // 2 ÷ 0,5
    expect(r.runwayDias).toBeCloseTo(28, 5) // 4 ÷ (1/7)
    expect(r.isDaily).toBe(false)
  })

  it('dias_alternados 2x/dia dose 1u, estoque 20 → 20 doses / runway 20 dias', () => {
    const medicine = { dosage_unit: 'mg' } // sólido
    const protocols = [
      { medicine_id: 'm1', active: true, time_schedule: ['08:00', '20:00'], dosage_per_intake: 1, frequency: 'dias_alternados' },
    ]
    const r = stockDoseMetrics(20, protocols, medicine)
    expect(r.dosesRemaining).toBe(20)       // 20 ÷ 1 (doses físicas, não dias-de-tomada=10)
    expect(r.runwayDias).toBeCloseTo(20, 5) // 20 ÷ (2 × 1/2)
    expect(r.dosesPorDia).toBeCloseTo(1, 5)
  })

  it('diário 2x/dia dose 1u, estoque 10 → 10 doses / runway 5 dias (sem regressão)', () => {
    const medicine = { dosage_unit: 'mg' }
    const protocols = [
      { medicine_id: 'm1', active: true, time_schedule: ['08:00', '20:00'], dosage_per_intake: 1, frequency: 'diario' },
    ]
    const r = stockDoseMetrics(10, protocols, medicine)
    expect(r.dosesRemaining).toBe(10)
    expect(r.runwayDias).toBeCloseTo(5, 5)
    expect(r.isDaily).toBe(true)
  })

  it('insulina U-100 diária 10 UI, estoque 1,25 ml → 5 doses (conversão UI→ml)', () => {
    const medicine = { dosage_unit: 'ui/ml', units_per_ml: 100 }
    const protocols = [
      { medicine_id: 'm1', active: true, time_schedule: ['22:00'], dosage_per_intake: 25, intake_unit: 'UI', frequency: 'diario' },
    ]
    const r = stockDoseMetrics(1.25, protocols, medicine)
    expect(r.dosesRemaining).toBe(5) // 1,25 ml ÷ 0,25 ml (25 UI ÷ 100)
    expect(r.runwayDias).toBeCloseTo(5, 5)
  })

  // Failure modes (R-270).
  it('estoque 0 → tudo zero, sem NaN/Infinity', () => {
    const r = stockDoseMetrics(0, [{ medicine_id: 'm1', active: true, dosage_per_intake: 1, frequency: 'diario' }], { dosage_unit: 'mg' })
    expect(r.dosesRemaining).toBe(0)
    expect(r.runwayDias).toBe(0)
  })

  it('sem protocolos ativos → zero', () => {
    const r = stockDoseMetrics(10, [], { dosage_unit: 'mg' })
    expect(r.dosesRemaining).toBe(0)
    expect(r.runwayDias).toBe(0)
  })

  it('dosePorTomada ausente → assume 1 (sem divisão por zero)', () => {
    const r = stockDoseMetrics(8, [{ medicine_id: 'm1', active: true, time_schedule: ['08:00'], frequency: 'diario' }], { dosage_unit: 'mg' })
    expect(r.dosesRemaining).toBe(8)
    expect(Number.isFinite(r.runwayDias)).toBe(true)
  })
})
