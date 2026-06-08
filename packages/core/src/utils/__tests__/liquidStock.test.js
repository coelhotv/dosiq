import { describe, it, expect } from 'vitest'
import { doseToMl, calculateDailyIntake } from '../adherenceLogic'
import {
  formatIntakeDose,
  isLiquidMedicine,
  stockUnitLabel,
  formatStockCount,
  formatStockQuantity,
} from '../doseUnit'

describe('formatIntakeDose (exibição de dose — cards/detalhe 022)', () => {
  it('líquido gotas → unidade + equivalência ml', () => {
    expect(formatIntakeDose(40, 'gotas', { dosage_unit: 'mg/ml', units_per_ml: 20 })).toBe(
      '40 gotas (≈ 2 ml)'
    )
  })
  it('líquido UI → unidade + ml', () => {
    expect(formatIntakeDose(100, 'UI', { dosage_unit: 'ui/ml', units_per_ml: 100 })).toBe(
      '100 UI (≈ 1 ml)'
    )
  })
  it('líquido em ml → só ml (sem equivalência redundante)', () => {
    expect(formatIntakeDose(5, 'ml', { dosage_unit: 'mg/ml' })).toBe('5 ml')
  })
  it('líquido gotas sem densidade → fallback 20', () => {
    expect(formatIntakeDose(20, 'gotas', { dosage_unit: 'mg/ml' })).toBe('20 gotas (≈ 1 ml)')
  })
  it('sólido → hint de princípio ativo', () => {
    expect(formatIntakeDose(2, null, { dosage_unit: 'un', dosage_per_pill: 1 })).toBe('2 unidades')
  })
})

describe('helpers de estoque líquido (022 Fase C)', () => {
  it('isLiquidMedicine: true só p/ dosage_unit terminando em /ml', () => {
    expect(isLiquidMedicine({ dosage_unit: 'mg/ml' })).toBe(true)
    expect(isLiquidMedicine({ dosage_unit: 'ui/ml' })).toBe(true)
    expect(isLiquidMedicine({ dosage_unit: 'mg' })).toBe(false)
    expect(isLiquidMedicine(null)).toBe(false)
  })

  it('stockUnitLabel: ml p/ líquido, un. p/ sólido', () => {
    expect(stockUnitLabel({ dosage_unit: 'mg/ml' })).toBe('ml')
    expect(stockUnitLabel({ dosage_unit: 'mg' })).toBe('un.')
    expect(stockUnitLabel(null)).toBe('un.')
  })

  it('formatStockCount: líquido em ml, sólido em unidade(s)', () => {
    expect(formatStockCount(30, { dosage_unit: 'mg/ml' })).toBe('30 ml')
    expect(formatStockCount(30, { dosage_unit: 'mg' })).toBe('30 unidades')
    expect(formatStockCount(1, { dosage_unit: 'mg' })).toBe('1 unidade')
  })

  it('formatStockQuantity: líquido ml; sólido hint princípio ativo / fallback un.', () => {
    expect(formatStockQuantity(30, { dosage_unit: 'mg/ml' })).toBe('30 ml')
    // 30 × 500 mg = 15.000 mg → convertMetricUnit escala p/ 15 g (>= 5000)
    expect(formatStockQuantity(30, { dosage_unit: 'mg', dosage_per_pill: 500 })).toBe(
      '30 un. (15 g)'
    )
    // sem dosage_per_pill e unidade 'un' → contagem simples '5 unidades'
    expect(formatStockQuantity(5, { dosage_unit: 'un' })).toBe('5 unidades')
  })
})

describe('doseToMl (conversão de tomada → ml — líquidos 022)', () => {
  it('ml: escala direta', () => {
    expect(doseToMl(2.5, 'ml', 20)).toBe(2.5)
  })
  it('gotas: divide pela densidade', () => {
    expect(doseToMl(20, 'gotas', 20)).toBe(1) // 20 gotas / 20 gotas-por-ml = 1 ml
    expect(doseToMl(10, 'gotas', 20)).toBe(0.5)
  })
  it('UI: divide pela densidade', () => {
    expect(doseToMl(100, 'UI', 100)).toBe(1) // 100 UI / 100 UI-por-ml = 1 ml
  })
  it('sem intake_unit → retorna dose original', () => {
    expect(doseToMl(3, null, 20)).toBe(3)
  })
  it('densidade ausente/zero → fallback 20', () => {
    expect(doseToMl(20, 'gotas', null)).toBe(1)
    expect(doseToMl(20, 'gotas', 0)).toBe(1)
  })
})

describe('calculateDailyIntake (líquidos em ml)', () => {
  const protocols = [
    {
      medicine_id: 'm1',
      active: true,
      dosage_per_intake: 20, // 20 gotas
      intake_unit: 'gotas',
      time_schedule: ['08:00', '20:00'], // 2x/dia
    },
  ]

  it('sólido: soma em unidades de tomada (sem medicine)', () => {
    expect(calculateDailyIntake('m1', protocols)).toBe(40) // 20 × 2
  })

  it('líquido: converte gotas → ml via units_per_ml', () => {
    const medicine = { dosage_unit: 'mg/ml', units_per_ml: 20 }
    // 20 gotas / 20 = 1 ml por tomada × 2 tomadas = 2 ml/dia
    expect(calculateDailyIntake('m1', protocols, medicine)).toBe(2)
  })

  it('líquido sem densidade → fallback 20', () => {
    const medicine = { dosage_unit: 'mg/ml' }
    expect(calculateDailyIntake('m1', protocols, medicine)).toBe(2)
  })

  it('medicine sólido informado → não converte', () => {
    const medicine = { dosage_unit: 'mg' }
    expect(calculateDailyIntake('m1', protocols, medicine)).toBe(40)
  })
})
