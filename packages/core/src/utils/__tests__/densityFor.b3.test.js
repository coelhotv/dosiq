import { describe, it, expect } from 'vitest'
import { densityFor, formatConcentrationLabel } from '../doseUnit.js'
import { doseToMl } from '../adherenceLogic.js'

// 012 Fase B3 (ADR-065): densidade unit-aware substitui o blanket 20.
describe('densityFor (FR-024)', () => {
  it('densidade explícita tem prioridade', () => {
    expect(densityFor('gotas', 25)).toBe(25)
    expect(densityFor('UI', 200)).toBe(200) // U-200
    expect(densityFor('gotas', '0,5')).toBe(0.5) // vírgula PT-BR
  })
  it('padrão por unidade quando densidade ausente', () => {
    expect(densityFor('gotas', null)).toBe(20)
    expect(densityFor('gotas', 0)).toBe(20)
    expect(densityFor('UI', null)).toBe(100)
    expect(densityFor('ui', undefined)).toBe(100)
  })
  it('sem padrão seguro → null (ml/mg/desconhecido)', () => {
    expect(densityFor('ml', null)).toBeNull()
    expect(densityFor('mg', null)).toBeNull()
    expect(densityFor(null, null)).toBeNull()
  })
})

describe('doseToMl unit-aware (FR-024)', () => {
  it('UI sem densidade usa 100 (não 20)', () => {
    expect(doseToMl(100, 'UI', null)).toBe(1) // 100 UI / 100 = 1 ml
  })
  it('gotas sem densidade usa 20', () => {
    expect(doseToMl(40, 'gotas', null)).toBe(2) // 40 / 20 = 2 ml
  })
  it('densidade explícita tem prioridade', () => {
    expect(doseToMl(40, 'gotas', 40)).toBe(1)
  })
  it('mg usa concentração (dosage_per_pill), não densidade', () => {
    expect(doseToMl(2.5, 'mg', 20, 5)).toBe(0.5)
  })
  it('ml é dose direta', () => {
    expect(doseToMl(3, 'ml', null)).toBe(3)
  })
})

// 012 Fase B3 (ADR-066): rótulo reconstruído com denominador.
describe('formatConcentrationLabel com volume (FR-031)', () => {
  it('volume 1 (default) — compatível com B2', () => {
    expect(formatConcentrationLabel(0.68)).toBe('0,68 mg em 1 mL')
    expect(formatConcentrationLabel(5, 1)).toBe('5 mg em 1 mL')
  })
  it('Mounjaro: razão 5, volume 0,5 → "2,5 mg em 0,5 mL"', () => {
    expect(formatConcentrationLabel(5, 0.5)).toBe('2,5 mg em 0,5 mL')
  })
  it('volume inválido/0 cai para 1 mL', () => {
    expect(formatConcentrationLabel(5, 0)).toBe('5 mg em 1 mL')
    expect(formatConcentrationLabel(5, null)).toBe('5 mg em 1 mL')
  })
  it('razão inválida → string vazia', () => {
    expect(formatConcentrationLabel(null)).toBe('')
    expect(formatConcentrationLabel(0)).toBe('')
  })
})
