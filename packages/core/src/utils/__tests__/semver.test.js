import { describe, it, expect } from 'vitest'
import { compareSemver, satisfiesSemver } from '../semver.js'

describe('compareSemver', () => {
  it('retorna 0 para versões iguais', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
  })

  it('retorna -1 quando a < b (major)', () => {
    expect(compareSemver('0.9.0', '1.0.0')).toBe(-1)
  })

  it('retorna 1 quando a > b (minor)', () => {
    expect(compareSemver('1.3.0', '1.2.9')).toBe(1)
  })

  it('compara patch corretamente', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toBe(-1)
    expect(compareSemver('1.2.4', '1.2.3')).toBe(1)
  })

  it('aceita versão com 2 partes (MAJOR.MINOR)', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0)
  })

  it('retorna null para versão inválida', () => {
    expect(compareSemver('abc', '1.0.0')).toBeNull()
    expect(compareSemver('1.0.0', null)).toBeNull()
    expect(compareSemver(undefined, '1.0.0')).toBeNull()
    expect(compareSemver('1.a.0', '1.0.0')).toBeNull()
  })
})

describe('satisfiesSemver', () => {
  it('retorna true sem limites', () => {
    expect(satisfiesSemver('1.0.0', null, null)).toBe(true)
    expect(satisfiesSemver('1.0.0', undefined, undefined)).toBe(true)
  })

  it('retorna true quando dentro do intervalo [min, max]', () => {
    expect(satisfiesSemver('1.5.0', '1.0.0', '2.0.0')).toBe(true)
    expect(satisfiesSemver('1.0.0', '1.0.0', '2.0.0')).toBe(true)
    expect(satisfiesSemver('2.0.0', '1.0.0', '2.0.0')).toBe(true)
  })

  it('retorna false quando abaixo do min', () => {
    expect(satisfiesSemver('0.9.9', '1.0.0', null)).toBe(false)
  })

  it('retorna false quando acima do max', () => {
    expect(satisfiesSemver('2.0.1', null, '2.0.0')).toBe(false)
  })

  it('retorna false para versão inválida', () => {
    expect(satisfiesSemver(null, '1.0.0', null)).toBe(false)
    expect(satisfiesSemver('abc', null, null)).toBe(false)
  })

  it('retorna false quando min é inválido', () => {
    expect(satisfiesSemver('1.0.0', 'abc', null)).toBe(false)
  })
})
