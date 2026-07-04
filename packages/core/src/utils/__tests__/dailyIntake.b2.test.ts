import { describe, it, expect } from 'vitest'
import { doseToMl, frequencyDailyFactor, calculateDailyIntake, calculateDaysRemaining } from '../adherenceLogic'

// 012 Fase B2 — consumo diário de líquidos: mg via concentração + cadência da frequência.
describe('doseToMl mg (FR-017)', () => {
  it('mg → ml via concentração (dosage_per_pill), não units_per_ml', () => {
    // Mounjaro 5 mg/ml: 2,5 mg ÷ 5 = 0,5 ml. units_per_ml (20) ignorado.
    expect(doseToMl(2.5, 'mg', 20, 5)).toBe(0.5)
  })
  it('sem concentração → dose crua (não inventa conversão)', () => {
    expect(doseToMl(2.5, 'mg', 20, null)).toBe(2.5)
  })
  it('gotas/UI continuam via units_per_ml', () => {
    expect(doseToMl(40, 'gotas', 20)).toBe(2)
    expect(doseToMl(100, 'UI', 100)).toBe(1)
  })
})

describe('frequencyDailyFactor', () => {
  it('cadências', () => {
    expect(frequencyDailyFactor({ frequency: 'diário' })).toBe(1)
    expect(frequencyDailyFactor({ frequency: 'semanal' })).toBeCloseTo(1 / 7)
    expect(frequencyDailyFactor({ frequency: 'dias_alternados' })).toBe(0.5)
    expect(frequencyDailyFactor({ frequency: 'personalizado', weekdays: ['segunda', 'quinta'] })).toBeCloseTo(2 / 7)
    expect(frequencyDailyFactor({ frequency: 'quando_necessário' })).toBe(1)
  })
})

describe('calculateDailyIntake — Mounjaro semanal (caso do smoke PO)', () => {
  const medicine = { dosage_unit: 'mg/ml', dosage_per_pill: 5, units_per_ml: null }
  const protocols = [
    {
      medicine_id: 'm1',
      active: true,
      frequency: 'semanal',
      time_schedule: ['08:00'],
      dosage_per_intake: 2.5,
      intake_unit: 'mg',
      weekdays: ['segunda'],
    },
  ]

  it('consumo diário = 0,5 ml ÷ 7 (não 0,125 ml/dia)', () => {
    const daily = calculateDailyIntake('m1', protocols, medicine)
    expect(daily).toBeCloseTo(0.5 / 7)
  })

  it('4 frascos × 0,5 ml = 2 ml → 28 dias (4 aplicações semanais), não 16', () => {
    const daily = calculateDailyIntake('m1', protocols, medicine)
    expect(calculateDaysRemaining(2, daily)).toBe(28)
  })
})
