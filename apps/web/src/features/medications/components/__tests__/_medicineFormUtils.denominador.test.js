import { describe, it, expect } from 'vitest'
import {
  buildMedicinePayload,
  getInitialFormData,
  validateMedicineForm,
} from '../_medicineFormUtils.js'

// 012 Fase B3 (FR-031/ADR-066): concentração com denominador.
const baseLiquid = {
  name: 'Mounjaro', laboratory: '', active_ingredient: '',
  dosage_unit: 'mg/ml', units_per_ml: '', presentation: 'injetavel', type: 'medicamento',
}

describe('buildMedicinePayload — denominador', () => {
  it('Mounjaro 2,5 mg / 0,5 mL → razão 5 + volume 0,5', () => {
    const p = buildMedicinePayload({ ...baseLiquid, dosage_per_pill: '2,5', concentration_volume_ml: '0,5' })
    expect(p.dosage_per_pill).toBe(5)
    expect(p.concentration_volume_ml).toBe(0.5)
  })
  it('denominador default (vazio) → passthrough + coluna null', () => {
    const p = buildMedicinePayload({ ...baseLiquid, dosage_per_pill: '5', concentration_volume_ml: '' })
    expect(p.dosage_per_pill).toBe(5)
    expect(p.concentration_volume_ml).toBeNull()
  })
  it('denominador 1 explícito → coluna null (não polui)', () => {
    const p = buildMedicinePayload({ ...baseLiquid, dosage_per_pill: '5', concentration_volume_ml: '1' })
    expect(p.dosage_per_pill).toBe(5)
    expect(p.concentration_volume_ml).toBeNull()
  })
  it('sólido ignora denominador (sempre null)', () => {
    const p = buildMedicinePayload({
      name: 'Dipirona', laboratory: '', active_ingredient: '',
      dosage_per_pill: '500', dosage_unit: 'mg', concentration_volume_ml: '0,5',
      presentation: 'comprimido', type: 'medicamento', units_per_ml: '',
    })
    expect(p.dosage_per_pill).toBe(500)
    expect(p.concentration_volume_ml).toBeNull()
  })
})

describe('getInitialFormData — reexibe amount do rótulo', () => {
  it('razão 5 + volume 0,5 → campo mostra amount 2,5', () => {
    const f = getInitialFormData({ dosage_per_pill: 5, concentration_volume_ml: 0.5, dosage_unit: 'mg/ml' })
    expect(Number(f.dosage_per_pill)).toBe(2.5)
    expect(String(f.concentration_volume_ml)).toBe('0.5')
  })
  it('sem volume → exibe a razão crua', () => {
    const f = getInitialFormData({ dosage_per_pill: 40, dosage_unit: 'mg/ml' })
    expect(Number(f.dosage_per_pill)).toBe(40)
    expect(f.concentration_volume_ml).toBe('')
  })
})

describe('validateMedicineForm — denominador > 0', () => {
  it('denominador 0 → erro (não divide por zero)', () => {
    const e = validateMedicineForm({ ...baseLiquid, dosage_per_pill: '2,5', concentration_volume_ml: '0' })
    expect(e.concentration_volume_ml).toBeTruthy()
  })
  it('denominador vazio → sem erro (default 1)', () => {
    const e = validateMedicineForm({ ...baseLiquid, dosage_per_pill: '5', concentration_volume_ml: '' })
    expect(e.concentration_volume_ml).toBeUndefined()
  })
})
