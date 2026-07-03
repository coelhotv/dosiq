import { describe, it, expect, vi, afterEach } from 'vitest'
import { calculateAge, getInitials } from '../profile'

afterEach(() => {
  vi.useRealTimers()
})

describe('getInitials', () => {
  it('deriva 2 iniciais maiúsculas', () => {
    expect(getInitials('Antonio Coelho')).toBe('AC')
  })
  it('1 palavra → 1 inicial', () => {
    expect(getInitials('Maria')).toBe('M')
  })
  it('3+ palavras → só as 2 primeiras', () => {
    expect(getInitials('Ana Paula Souza')).toBe('AP')
  })
  it('vazio/null → string vazia', () => {
    expect(getInitials('')).toBe('')
    expect(getInitials(null)).toBe('')
    expect(getInitials(undefined)).toBe('')
  })
  it('ignora espaços extras', () => {
    expect(getInitials('  joão   silva ')).toBe('JS')
  })
})

describe('calculateAge', () => {
  it('null/ausente → null', () => {
    expect(calculateAge(null)).toBeNull()
    expect(calculateAge(undefined)).toBeNull()
    expect(calculateAge('')).toBeNull()
  })

  it('calcula anos completos (aniversário já passou no ano)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T12:00:00-03:00'))
    expect(calculateAge('1976-11-18')).toBe(49)
  })

  it('aniversário ainda não chegou no ano → 1 a menos', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-24T12:00:00-03:00'))
    expect(calculateAge('2000-12-31')).toBe(25)
  })

  it('data inválida → null', () => {
    expect(calculateAge('not-a-date')).toBeNull()
  })
})
