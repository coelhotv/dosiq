import { describe, it, expect } from 'vitest'
import {
  isLiquidUnit,
  validateMedicineForm,
  buildMedicinePayload,
} from '../_medicineFormUtils.js'

describe('isLiquidUnit', () => {
  it('detecta unidades /ml como líquidas', () => {
    expect(isLiquidUnit('mg/ml')).toBe(true)
    expect(isLiquidUnit('ui/ml')).toBe(true)
  })
  it('sólidos não são líquidos', () => {
    expect(isLiquidUnit('mg')).toBe(false)
    expect(isLiquidUnit('un')).toBe(false)
    expect(isLiquidUnit(undefined)).toBe(false)
  })
})

describe('validateMedicineForm — densidade NÃO exigida no medicamento (022 Fase C)', () => {
  it('líquido sem densidade → sem erro (densidade é do tratamento)', () => {
    const errors = validateMedicineForm({ name: 'Xarope', dosage_per_pill: '100', dosage_unit: 'mg/ml', units_per_ml: '' })
    expect(errors.units_per_ml).toBeUndefined()
  })
  it('sólido sem densidade → sem erro', () => {
    const errors = validateMedicineForm({ name: 'Dipirona', dosage_per_pill: '500', dosage_unit: 'mg', units_per_ml: '' })
    expect(errors.units_per_ml).toBeUndefined()
  })
})

describe('buildMedicinePayload — líquido', () => {
  it('líquido sem densidade → presentation=liquido, units_per_ml null', () => {
    const payload = buildMedicinePayload({
      name: 'Xarope', laboratory: '', active_ingredient: '',
      dosage_per_pill: '100', dosage_unit: 'mg/ml', units_per_ml: '',
      presentation: 'comprimido', type: 'medicamento',
    })
    expect(payload.units_per_ml).toBeNull()
    expect(payload.presentation).toBe('liquido')
  })
  it('líquido com densidade preexistente (edição) → preserva', () => {
    const payload = buildMedicinePayload({
      name: 'Xarope', laboratory: '', active_ingredient: '',
      dosage_per_pill: '100', dosage_unit: 'mg/ml', units_per_ml: '20',
      presentation: 'liquido', type: 'medicamento',
    })
    expect(payload.units_per_ml).toBe(20)
    expect(payload.presentation).toBe('liquido')
  })
  it('sólido zera units_per_ml + mantém presentation', () => {
    const payload = buildMedicinePayload({
      name: 'Dipirona', laboratory: '', active_ingredient: '',
      dosage_per_pill: '500', dosage_unit: 'mg', units_per_ml: '',
      presentation: 'comprimido', type: 'medicamento',
    })
    expect(payload.units_per_ml).toBeNull()
    expect(payload.presentation).toBe('comprimido')
  })
})
