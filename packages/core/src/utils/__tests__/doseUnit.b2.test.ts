import { describe, it, expect } from 'vitest'
import {
  formatConcentrationLabel,
  formatStockApplications,
  formatIntakeDose,
} from '../doseUnit'

// 012 Fase B2 — helpers de canetas GLP-1 (mg + rendimento em aplicações).
describe('formatConcentrationLabel (FR-018)', () => {
  it('formata "[X] mg em 1 mL" com vírgula PT-BR', () => {
    expect(formatConcentrationLabel(0.68)).toBe('0,68 mg em 1 mL')
    expect(formatConcentrationLabel(5)).toBe('5 mg em 1 mL')
  })

  it('aceita string com vírgula', () => {
    expect(formatConcentrationLabel('0,68')).toBe('0,68 mg em 1 mL')
  })

  it('retorna "" para densidade inválida/ausente (form exige antes de salvar)', () => {
    expect(formatConcentrationLabel(null)).toBe('')
    expect(formatConcentrationLabel(0)).toBe('')
    expect(formatConcentrationLabel('abc')).toBe('')
  })
})

describe('formatStockApplications (FR-020)', () => {
  it('floor — nunca arredonda p/ cima (overfill não é dose disponível)', () => {
    // 1,5 ml ÷ 0,37 ml/aplicação = 4,05 → 4 (não 5)
    expect(formatStockApplications(1.5, 0.37, 'caneta')).toBe('≈ 4 canetas')
  })

  it('Ozempic: 10 ml, 0,25 mg/0,68(mg/ml)=0,3676 ml/aplicação → 27 aplicações', () => {
    expect(formatStockApplications(10, 0.25 / 0.68, 'caneta')).toBe('≈ 27 canetas')
  })

  it('singular quando conta = 1', () => {
    expect(formatStockApplications(0.4, 0.37, 'caneta')).toBe('≈ 1 caneta')
  })

  it('fallback "aplicação(ões)" quando container null', () => {
    expect(formatStockApplications(1.5, 0.37, null)).toBe('≈ 4 aplicações')
    expect(formatStockApplications(0.4, 0.37, null)).toBe('≈ 1 aplicação')
  })

  it('plural de "ão" → "ões"', () => {
    expect(formatStockApplications(10, 1, 'aplicação')).toBe('≈ 10 aplicações')
  })

  it('ml-por-aplicação 0/NULL → saldo cru em ml (não inventa contagem)', () => {
    expect(formatStockApplications(10, 0, 'caneta')).toBe('10 ml')
    expect(formatStockApplications(10, null, 'caneta')).toBe('10 ml')
  })

  it('saldo 0 → 0 aplicações', () => {
    expect(formatStockApplications(0, 0.37, 'caneta')).toBe('≈ 0 canetas')
  })

  it('normaliza vírgula PT-BR nos numéricos', () => {
    expect(formatStockApplications('1,5', '0,37', 'caneta')).toBe('≈ 4 canetas')
  })
})

describe('formatIntakeDose com intake_unit mg (FR-017)', () => {
  it('GLP-1: mg → ml via CONCENTRAÇÃO (dosage_per_pill), não units_per_ml', () => {
    // Mounjaro 5 mg/ml: 2,5 mg ÷ 5 = 0,5 ml. units_per_ml é ignorado p/ mg.
    const med = { dosage_unit: 'mg/ml', dosage_per_pill: 5, units_per_ml: 20 }
    expect(formatIntakeDose(2.5, 'mg', med)).toBe('2,5 mg (≈ 0,5 ml)')
  })

  it('Ozempic 0,68 mg/ml: 0,25 mg ÷ 0,68 = 0,37 ml', () => {
    const med = { dosage_unit: 'mg/ml', dosage_per_pill: 0.68 }
    expect(formatIntakeDose(0.25, 'mg', med)).toBe('0,25 mg (≈ 0,37 ml)')
  })

  it('sem concentração → só a dose em mg (sem ≈ml)', () => {
    expect(formatIntakeDose(0.25, 'mg', { dosage_unit: 'mg/ml' })).toBe('0,25 mg')
  })
})
