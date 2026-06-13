import { describe, it, expect } from 'vitest'
import { calculateMonthlyCosts } from '../costAnalysisService'

// 012 Fase B4 / ADR-067 — custo por DOSE (métrica primária), não por dia ilegível.
describe('calculateMonthlyCosts — custoPorDose (B4)', () => {
  it('Mounjaro semanal: custo/dose = R$425 (não R$0,07/dia ilegível)', () => {
    // Caneta 2 ml a R$850/ml; dose 0,5 ml/semana → 4 doses na caneta → R$425/dose.
    const medicines = [
      {
        id: 'm1',
        name: 'Mounjaro',
        dosage_unit: 'mg/ml',
        units_per_ml: 5,
        dosage_per_pill: 5,
        purchases: [{ quantity_bought: 2, unit_price: 850 }],
      },
    ]
    const protocols = [
      { medicine_id: 'm1', active: true, time_schedule: ['08:00'], dosage_per_intake: 0.5, intake_unit: 'ml', frequency: 'semanal' },
    ]

    const { items } = calculateMonthlyCosts(medicines, protocols)
    const m = items.find((i) => i.medicineId === 'm1')

    expect(m.custoPorDose).toBeCloseTo(425, 2) // 0,5 ml × R$850/ml
    expect(m.dosesPorDia).toBeCloseTo(1 / 7, 5)
    // custo/dia derivado (a dízima que o card NÃO deve exibir crua)
    expect(m.custoPorDia).toBeCloseTo(425 / 7, 4)
  })

  it('diário 2x/dia: custo/dose coerente (dose única, não o dia inteiro)', () => {
    // Comprimido R$2/un; 1 cp/tomada, 2x/dia → custo/dose R$2, custo/dia R$4.
    const medicines = [
      { id: 'm2', name: 'Metformina', dosage_unit: 'mg', purchases: [{ quantity_bought: 60, unit_price: 2 }] },
    ]
    const protocols = [
      { medicine_id: 'm2', active: true, time_schedule: ['08:00', '20:00'], dosage_per_intake: 1, frequency: 'diario' },
    ]

    const { items } = calculateMonthlyCosts(medicines, protocols)
    const m = items.find((i) => i.medicineId === 'm2')

    expect(m.custoPorDose).toBeCloseTo(2, 5)
    expect(m.custoPorDia).toBeCloseTo(4, 5)
    expect(m.dosesPorDia).toBeCloseTo(2, 5)
  })
})
