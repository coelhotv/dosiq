// 053 Slice A — testes de GRAFIA (PO-1/PO-6): assertam a string COMPLETA de
// saída, não regex frouxa nem só o número. Mutar 'mL'→'ml' em qualquer
// formatador abaixo tem que acender pelo menos um vermelho aqui.

import { describe, it, expect } from 'vitest'
import {
  formatDose,
  formatConcentration,
  formatMedicineFullName,
  formatMedicineConcentration,
  formatIntakeDose,
  stockUnitLabel,
  formatStockCount,
  formatStockApplications,
} from '../doseUnit'
import { DOSAGE_UNIT_LABELS } from '../../schemas/medicineSchema'
import { INTAKE_UNIT_LABELS } from '../../schemas/protocolSchema'

describe('grafia canônica de unidade (mL — 053)', () => {
  it('DOSAGE_UNIT_LABELS: mg/ml e ui/ml emitem mL maiúsculo; chaves intocadas', () => {
    expect(DOSAGE_UNIT_LABELS['mg/ml']).toBe('mg/mL')
    expect(DOSAGE_UNIT_LABELS['ui/ml']).toBe('UI/mL')
    expect(Object.keys(DOSAGE_UNIT_LABELS)).toEqual(['mg', 'mcg', 'g', 'mg/ml', 'ui/ml', 'ui', 'un'])
  })

  it('INTAKE_UNIT_LABELS: ml emite mL maiúsculo; chaves intocadas', () => {
    expect(INTAKE_UNIT_LABELS.ml).toBe('mL')
    expect(Object.keys(INTAKE_UNIT_LABELS)).toEqual(['gotas', 'ml', 'UI', 'mg'])
  })

  it('formatMedicineFullName: nome + concentração líquida com espaço + mL', () => {
    expect(
      formatMedicineFullName({ name: 'Mounjaro', dosage_unit: 'mg/ml', dosage_per_pill: 5, concentration_volume_ml: 0.5 })
    ).toBe('Mounjaro 2,5 mg / 0,5 mL')
  })

  it('formatMedicineConcentration: mesma grafia isolada do nome', () => {
    expect(
      formatMedicineConcentration({ dosage_per_pill: 5, dosage_unit: 'mg/ml', concentration_volume_ml: 0.5 })
    ).toBe('2,5 mg / 0,5 mL')
  })

  it('formatConcentration: ui/ml sem denominador emite UI/mL', () => {
    expect(formatConcentration(100, 'ui/ml')).toBe('100 UI/mL')
  })

  it('formatDose: ml emite mL com espaço', () => {
    expect(formatDose(2.5, 'ml')).toBe('2,5 mL')
  })

  it('formatIntakeDose: equivalência em mL entre parênteses', () => {
    expect(formatIntakeDose(40, 'gotas', { dosage_unit: 'mg/ml', units_per_ml: 20 })).toBe('40 gotas (≈ 2 mL)')
  })

  it('stockUnitLabel: mL maiúsculo para líquido', () => {
    expect(stockUnitLabel({ dosage_unit: 'mg/ml' })).toBe('mL')
  })

  it('formatStockCount: mL maiúsculo na contagem crua', () => {
    expect(formatStockCount(30, { dosage_unit: 'mg/ml' })).toBe('30 mL')
  })

  it('formatStockApplications: fallback sem divisor emite mL maiúsculo', () => {
    expect(formatStockApplications(10, 0, 'caneta')).toBe('10 mL')
  })

  it('zero teste nesta suíte assert grafia "ml" minúscula em saída de formatador', () => {
    const outputs = [
      formatMedicineFullName({ name: 'Mounjaro', dosage_unit: 'mg/ml', dosage_per_pill: 5, concentration_volume_ml: 0.5 }),
      formatConcentration(100, 'ui/ml'),
      formatDose(2.5, 'ml'),
      formatIntakeDose(40, 'gotas', { dosage_unit: 'mg/ml', units_per_ml: 20 }),
      stockUnitLabel({ dosage_unit: 'mg/ml' }),
      formatStockCount(30, { dosage_unit: 'mg/ml' }),
    ]
    for (const out of outputs) {
      expect(out).not.toMatch(/\dml\b/)
      expect(out).not.toMatch(/ ml\b/)
    }
  })
})
