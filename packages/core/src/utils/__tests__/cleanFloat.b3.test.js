import { describe, it, expect } from 'vitest'
import { cleanFloat } from '../formUtils.js'

// 012 Fase B3 (review Gemini #661): limpa dízimas de ponto flutuante do JS.
describe('cleanFloat', () => {
  it('remove artefato de soma/multiplicação', () => {
    expect(0.1 + 0.2).not.toBe(0.3) // sanity: JS expõe 0.30000000000000004
    expect(cleanFloat(0.1 + 0.2)).toBe(0.3)
  })
  it('remove artefato de divisão', () => {
    expect(cleanFloat(0.3 / 0.1)).toBe(3)
  })
  it('preserva valores exatos', () => {
    expect(cleanFloat(5)).toBe(5)
    expect(cleanFloat(2.5)).toBe(2.5)
  })
  it('aceita string numérica', () => {
    expect(cleanFloat('2.5')).toBe(2.5)
  })
  it('não-finito passa direto (NaN)', () => {
    expect(Number.isNaN(cleanFloat(NaN))).toBe(true)
    expect(Number.isNaN(cleanFloat('abc'))).toBe(true)
  })
})
