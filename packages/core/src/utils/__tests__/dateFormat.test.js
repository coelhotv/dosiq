import { describe, it, expect } from 'vitest'
import { formatDatePtBR, formatEndDate } from '../dateFormat.js'

describe('formatDatePtBR', () => {
  it('formata string YYYY-MM-DD para DD MMM YYYY PT-BR lowercase', () => {
    expect(formatDatePtBR('2026-03-12')).toBe('12 mar 2026')
    expect(formatDatePtBR('2026-01-01')).toBe('01 jan 2026')
    expect(formatDatePtBR('2026-12-31')).toBe('31 dez 2026')
  })

  it('zero-pad em dias single-digit', () => {
    expect(formatDatePtBR('2026-05-03')).toBe('03 mai 2026')
  })

  it('retorna vazio para null/undefined/empty', () => {
    expect(formatDatePtBR(null)).toBe('')
    expect(formatDatePtBR(undefined)).toBe('')
    expect(formatDatePtBR('')).toBe('')
  })

  it('aceita Date object', () => {
    const d = new Date(2026, 6, 15)
    expect(formatDatePtBR(d)).toBe('15 jul 2026')
  })

  it('retorna vazio para tipo não-Date (number, object)', () => {
    expect(formatDatePtBR(12345)).toBe('')
    expect(formatDatePtBR({})).toBe('')
    expect(formatDatePtBR(true)).toBe('')
  })
})

describe('formatEndDate', () => {
  it('retorna "Uso contínuo" quando null/undefined', () => {
    expect(formatEndDate(null)).toBe('Uso contínuo')
    expect(formatEndDate(undefined)).toBe('Uso contínuo')
    expect(formatEndDate('')).toBe('Uso contínuo')
  })

  it('formata data quando presente', () => {
    expect(formatEndDate('2026-12-31')).toBe('31 dez 2026')
  })
})
