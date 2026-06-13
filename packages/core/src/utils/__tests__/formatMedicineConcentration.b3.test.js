import { describe, it, expect } from 'vitest'
import { formatMedicineConcentration, formatConcentration } from '../doseUnit.js'

// 012 Fase B3 (FR-031): card reexibe o rótulo original quando há denominador ≠ 1 mL.
describe('formatMedicineConcentration', () => {
  it('líquido c/ denominador 0,5 → reexibe rótulo (Mounjaro 2,5 mg / 0,5ml)', () => {
    expect(
      formatMedicineConcentration({ dosage_per_pill: 5, dosage_unit: 'mg/ml', concentration_volume_ml: 0.5 })
    ).toBe('2,5 mg / 0,5ml')
  })

  it('aceita volume como string com vírgula', () => {
    expect(
      formatMedicineConcentration({ dosage_per_pill: '5', dosage_unit: 'mg/ml', concentration_volume_ml: '0,5' })
    ).toBe('2,5 mg / 0,5ml')
  })

  it('unidade base UI maiúscula no rótulo', () => {
    expect(
      formatMedicineConcentration({ dosage_per_pill: 200, dosage_unit: 'ui/ml', concentration_volume_ml: 0.5 })
    ).toBe('100 UI / 0,5ml')
  })

  it('volume NULL → fallback razão crua', () => {
    expect(
      formatMedicineConcentration({ dosage_per_pill: 100, dosage_unit: 'ui/ml', concentration_volume_ml: null })
    ).toBe('100 UI/ml')
  })

  it('volume 1 explícito → fallback (não polui com /1 mL)', () => {
    expect(
      formatMedicineConcentration({ dosage_per_pill: 40, dosage_unit: 'mg/ml', concentration_volume_ml: 1 })
    ).toBe('40 mg/ml')
  })

  it('sólido ignora denominador', () => {
    expect(
      formatMedicineConcentration({ dosage_per_pill: 500, dosage_unit: 'mg', concentration_volume_ml: 0.5 })
    ).toBe('500 mg')
  })

  it('sem medicine → string vazia', () => {
    expect(formatMedicineConcentration(null)).toBe('')
  })
})

describe('formatConcentration — 3º arg volumeMl (motor)', () => {
  it('2 args legado → comportamento clássico', () => {
    expect(formatConcentration(100, 'ui/ml')).toBe('100 UI/ml')
    expect(formatConcentration(500, 'mg')).toBe('500 mg')
  })
  it('volume ≠ 1 reexibe rótulo', () => {
    expect(formatConcentration(5, 'mg/ml', 0.5)).toBe('2,5 mg / 0,5ml')
  })
  it('volume em sólido ignorado', () => {
    expect(formatConcentration(500, 'mg', 0.5)).toBe('500 mg')
  })
  it('limpa artefato de float (Gemini #661): 1,2 × 0,3 → 0,36 (não 0,36000000000000004)', () => {
    expect(formatConcentration(1.2, 'mg/ml', 0.3)).toBe('0,36 mg / 0,3ml')
  })
})
