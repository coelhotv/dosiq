import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getUserTime,
  getSaoPauloTime,
  getStartOfDayISO,
  getEndOfDayISO,
  getTodayLocal,
} from '../dateUtils'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

// Instante fixo: 2026-05-27T02:00:00Z
// Em SP (GMT-3): 2026-05-26T23:00:00
// Em Manaus (GMT-4): 2026-05-26T22:00:00
const ref = new Date('2026-05-27T02:00:00Z')

describe('getUserTime — divergência de fuso', () => {
  it('SP (GMT-3): ref 02:00Z → 23:00 no dia 26', () => {
    const sp = getUserTime(ref, 'America/Sao_Paulo')
    expect(sp.getHours()).toBe(23)
    expect(sp.getDate()).toBe(26)
  })

  it('Manaus (GMT-4): ref 02:00Z → 22:00 no dia 26', () => {
    const manaus = getUserTime(ref, 'America/Manaus')
    expect(manaus.getHours()).toBe(22)
    expect(manaus.getDate()).toBe(26)
  })

  it('horas SP (23) diferem de Manaus (22) para o mesmo instante', () => {
    const sp = getUserTime(ref, 'America/Sao_Paulo')
    const manaus = getUserTime(ref, 'America/Manaus')
    expect(sp.getHours()).not.toBe(manaus.getHours())
  })
})

describe('getUserTime — default e retrocompat', () => {
  it('sem tz → mesmo resultado que America/Sao_Paulo', () => {
    const dflt = getUserTime(ref)
    const sp = getUserTime(ref, 'America/Sao_Paulo')
    expect(dflt.getHours()).toBe(sp.getHours())
    expect(dflt.getDate()).toBe(sp.getDate())
  })

  it('getSaoPauloTime é wrapper de getUserTime SP', () => {
    const spWrapper = getSaoPauloTime(ref)
    const spDirect = getUserTime(ref, 'America/Sao_Paulo')
    expect(spWrapper.getHours()).toBe(spDirect.getHours())
  })
})

describe('getStartOfDayISO / getEndOfDayISO — multi-fuso', () => {
  it('meia-noite SP = 03:00Z', () => {
    expect(getStartOfDayISO('2026-05-27', 'America/Sao_Paulo')).toBe(
      '2026-05-27T03:00:00.000Z'
    )
  })

  it('meia-noite Manaus = 04:00Z', () => {
    expect(getStartOfDayISO('2026-05-27', 'America/Manaus')).toBe(
      '2026-05-27T04:00:00.000Z'
    )
  })

  it('default (sem tz) === versão SP', () => {
    expect(getStartOfDayISO('2026-05-27')).toBe(
      getStartOfDayISO('2026-05-27', 'America/Sao_Paulo')
    )
  })

  it('getEndOfDayISO Manaus = 1ms antes de start do dia seguinte em Manaus', () => {
    // start 2026-05-28 Manaus = 04:00Z → end 2026-05-27 Manaus = 2026-05-28T03:59:59.999Z
    expect(getEndOfDayISO('2026-05-27', 'America/Manaus')).toBe(
      '2026-05-28T03:59:59.999Z'
    )
  })

  it('end > start para o mesmo dia/tz', () => {
    const start = new Date(getStartOfDayISO('2026-05-27', 'America/Manaus'))
    const end = new Date(getEndOfDayISO('2026-05-27', 'America/Manaus'))
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })
})

describe('getTodayLocal — aceita tz', () => {
  it('retorna YYYY-MM-DD válido para America/Manaus', () => {
    const result = getTodayLocal('America/Manaus')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
