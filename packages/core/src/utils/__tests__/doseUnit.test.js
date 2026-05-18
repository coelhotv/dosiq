import { describe, it, expect } from 'vitest'
import { pluralizeDoseUnit, formatDoseUnit } from '../doseUnit.js'

describe('pluralizeDoseUnit (padronizado para unidade(s))', () => {
  it('singular quando qty === 1', () => {
    expect(pluralizeDoseUnit(1)).toBe('unidade')
    expect(pluralizeDoseUnit('1')).toBe('unidade')
  })

  it('plural quando qty !== 1', () => {
    expect(pluralizeDoseUnit(0)).toBe('unidades')
    expect(pluralizeDoseUnit(2)).toBe('unidades')
    expect(pluralizeDoseUnit(0.5)).toBe('unidades')
    expect(pluralizeDoseUnit(15)).toBe('unidades')
  })

  it('coerce string para number', () => {
    expect(pluralizeDoseUnit('1')).toBe('unidade')
    expect(pluralizeDoseUnit('2')).toBe('unidades')
    expect(pluralizeDoseUnit('0.5')).toBe('unidades')
  })

  it('fallback sem unidade-aware (decorrente da padronização)', () => {
    // Mesmo passando 2º argumento (legacy), ignora e retorna unidade(s)
    expect(pluralizeDoseUnit(1, 'mg')).toBe('unidade')
    expect(pluralizeDoseUnit(2, 'ml')).toBe('unidades')
  })
})

describe('formatDoseUnit', () => {
  it('formata inteiros', () => {
    expect(formatDoseUnit(1)).toBe('1 unidade')
    expect(formatDoseUnit(2)).toBe('2 unidades')
  })

  it('formata decimais com vírgula PT-BR', () => {
    expect(formatDoseUnit(0.5)).toBe('0,5 unidades')
    expect(formatDoseUnit(15.5)).toBe('15,5 unidades')
  })

  it('aceita string como qty', () => {
    expect(formatDoseUnit('1')).toBe('1 unidade')
    expect(formatDoseUnit('0.5')).toBe('0,5 unidades')
  })
})
