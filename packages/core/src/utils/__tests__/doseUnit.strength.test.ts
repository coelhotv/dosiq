import { describe, it, expect, afterEach, vi } from 'vitest'
import { formatStrength, labelAmount, formatConcentration, formatConcentrationLabel } from '../doseUnit'

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

describe('labelAmount (spec 113)', () => {
  it('razão × volume do rótulo; volume ausente/inválido = 1 mL; razão inválida ⇒ null', () => {
    expect(labelAmount(5, 0.5)).toBe(2.5)
    expect(labelAmount('5', '0,5')).toBe(2.5)
    expect(labelAmount(0.1, 3)).toBe(0.3)
    expect(labelAmount(5, null)).toBe(5)
    expect(labelAmount(5, 0)).toBe(5)
    expect(labelAmount(5, -1)).toBe(5)
    expect(labelAmount(5, 'abc')).toBe(5)
    expect(labelAmount(null, 0.5)).toBeNull()
    expect(labelAmount('', 0.5)).toBeNull()
    expect(labelAmount('x', 0.5)).toBeNull()
  })

  it('refator sem mudança: exibições existentes seguem iguais', () => {
    expect(formatConcentration(5, 'mg/ml', 0.5)).toBe('2,5 mg / 0,5 mL')
    expect(formatConcentrationLabel(5, 0.5)).toBe('2,5 mg em 0,5 mL')
  })
})

describe('formatStrength com volume do rótulo (spec 113)', () => {
  it('volume + dose ⇒ rótulo da caixa, ignorando o ds em razão', () => {
    expect(formatStrength('5 mg/ml', 5, 'mg/ml', 0.5)).toBe('2,5 mg / 0,5 mL')
    expect(formatStrength('30 mg/ml', 30, 'mg/ml', 0.5)).toBe('15 mg / 0,5 mL')
  })
  it('sem volume, volume ≤ 0 ou sem dose ⇒ idêntico a hoje', () => {
    expect(formatStrength('5 mg/ml', 5, 'mg/ml', null)).toBe('5 mg/mL')
    expect(formatStrength('5 mg/ml', 5, 'mg/ml', 0)).toBe('5 mg/mL')
    expect(formatStrength('5 mg/ml', null, 'mg/ml', 0.5)).toBe('5 mg/mL')
  })
})
