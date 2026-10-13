import { describe, it, expect, afterEach, vi } from 'vitest'
import { formatStrength } from '../doseUnit'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('formatStrength (spec 066, D9 / AP-306)', () => {
  it('composto em mg', () => {
    expect(formatStrength('500 mg + 125 mg')).toBe('500 mg + 125 mg')
  })

  it('decimal pt-BR e mL canônico para unidade do enum', () => {
    expect(formatStrength('0.8 mg/ml + 0.12 mg/ml')).toBe('0,8 mg/mL + 0,12 mg/mL')
    expect(formatStrength('100 ui/ml')).toBe('100 UI/mL')
  })

  it('unidade fora do enum sai como na caixa, só com mL/UI', () => {
    expect(formatStrength('1 mg/g + 25 mg/g')).toBe('1 mg/g + 25 mg/g')
    expect(formatStrength('2.5 mcg/ml')).toBe('2,5 mcg/mL')
    expect(formatStrength('10 ui/g')).toBe('10 UI/g')
    expect(formatStrength('4 meq/l')).toBe('4 meq/l')
  })

  it('componente fora do padrão volta com vírgula, nunca descartado', () => {
    expect(formatStrength('1.2 x')).toBe('1,2 x')
    expect(formatStrength('20 mg / g')).toBe('20 mg / g')
    expect(formatStrength('0.64 mg / g')).toBe('0,64 mg / g')
  })

  it('milhar com ponto', () => {
    expect(formatStrength('1000 mg')).toBe('1.000 mg')
  })

  it('sem ds: cai na dose escalar; sem nada: null', () => {
    expect(formatStrength(null, 75, 'mg')).toBe('75 mg')
    expect(formatStrength('', 0.5, 'mg/ml')).toBe('0,5 mg/mL')
    expect(formatStrength(null)).toBeNull()
    expect(formatStrength(undefined, null, 'mg')).toBeNull()
  })
})
