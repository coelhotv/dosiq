import { describe, it, expect } from 'vitest'
import { coerceDecimal } from '../formUtils.js'

// Decimal PT-BR (R-270/AP-167): inputs web type=text aceitam vírgula; coerceDecimal
// normaliza p/ Number antes de persistir. type=number nativo bloquearia a vírgula.
describe('coerceDecimal', () => {
  it('vírgula PT-BR → número', () => {
    expect(coerceDecimal('2,5')).toBe(2.5)
    expect(coerceDecimal('0,68')).toBe(0.68)
  })
  it('ponto também aceito', () => {
    expect(coerceDecimal('2.5')).toBe(2.5)
  })
  it('número passa direto', () => {
    expect(coerceDecimal(5)).toBe(5)
  })
  it('inteiro em string', () => {
    expect(coerceDecimal('100')).toBe(100)
  })
  it('vazio/null/undefined → NaN (validação decide)', () => {
    expect(Number.isNaN(coerceDecimal(''))).toBe(true)
    expect(Number.isNaN(coerceDecimal(null))).toBe(true)
    expect(Number.isNaN(coerceDecimal(undefined))).toBe(true)
  })
})
