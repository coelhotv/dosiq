// mondayOf — segunda-feira 00:00 LOCAL da semana (069 A1, promovido do ScatterTrend).
// Fixtures com o construtor local new Date(y, m, d, h, min): nunca toISOString p/ derivar dia (AP-270).

import { describe, it, expect, afterEach, vi } from 'vitest'
import { mondayOf, formatLocalDate } from '../dateUtils'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('mondayOf', () => {
  it('domingo 23h59 e segunda 00h00 locais caem em segundas diferentes', () => {
    const sundayLate = new Date(2026, 9, 4, 23, 59) // dom 04/10/2026
    const mondayStart = new Date(2026, 9, 5, 0, 0) // seg 05/10/2026
    expect(formatLocalDate(mondayOf(sundayLate))).toBe('2026-09-28')
    expect(formatLocalDate(mondayOf(mondayStart))).toBe('2026-10-05')
  })

  it('qualquer dia da semana devolve a mesma segunda', () => {
    for (let day = 5; day <= 11; day++) {
      expect(formatLocalDate(mondayOf(new Date(2026, 9, day, 12, 30)))).toBe('2026-10-05')
    }
  })

  it('zera o horário local', () => {
    const monday = mondayOf(new Date(2026, 9, 7, 18, 45, 12, 345))
    expect([monday.getHours(), monday.getMinutes(), monday.getSeconds(), monday.getMilliseconds()]).toEqual([0, 0, 0, 0])
  })

  it('atravessa virada de mês e de ano', () => {
    expect(formatLocalDate(mondayOf(new Date(2026, 0, 1, 9, 0)))).toBe('2025-12-29') // qui 01/01/2026
  })

  it('não muta a Date de entrada', () => {
    const input = new Date(2026, 9, 7, 18, 45)
    const before = input.getTime()
    mondayOf(input)
    expect(input.getTime()).toBe(before)
  })
})
