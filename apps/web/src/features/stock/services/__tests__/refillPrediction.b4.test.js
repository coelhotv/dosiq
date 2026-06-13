import { describe, it, expect } from 'vitest'
import { predictRefill } from '../refillPredictionService'

// 012 Fase B4 / ADR-067 — predictRefill aplica frequencyDailyFactor no consumo
// teórico → card de tratamento converge com card de estoque (antes divergia:
// Mounjaro "0 dias" no tratamento vs "28 dias" no estoque).
describe('predictRefill — frequencyDailyFactor (B4)', () => {
  it('Mounjaro semanal 0,5 ml, estoque 2 ml → ~28 dias (não ~4)', () => {
    const medicine = { dosage_unit: 'mg/ml', units_per_ml: 5 }
    const protocols = [
      { medicine_id: 'm1', active: true, time_schedule: ['08:00'], dosage_per_intake: 0.5, intake_unit: 'ml', frequency: 'semanal' },
    ]
    const { daysRemaining } = predictRefill({
      medicineId: 'm1',
      currentStock: 2,
      logs: [],
      protocols,
      medicine,
    })
    // 0,5 ml/semana = 0,0714 ml/dia → 2 ÷ 0,0714 = 28. Sem o fator daria floor(2/0,5)=4.
    expect(daysRemaining).toBe(28)
  })

  it('diário 1 ml/dia, estoque 10 ml → 10 dias (sem regressão)', () => {
    const medicine = { dosage_unit: 'mg/ml', units_per_ml: 1 }
    const protocols = [
      { medicine_id: 'm1', active: true, time_schedule: ['08:00'], dosage_per_intake: 1, intake_unit: 'ml', frequency: 'diario' },
    ]
    const { daysRemaining } = predictRefill({
      medicineId: 'm1',
      currentStock: 10,
      logs: [],
      protocols,
      medicine,
    })
    expect(daysRemaining).toBe(10)
  })
})
