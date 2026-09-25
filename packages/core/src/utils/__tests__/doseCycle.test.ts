/**
 * 085 C2 (smoke do PO) — dose total no ciclo da frequência.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { getDoseCycle, cycleDoseAmount, scheduleTimesPerDay } from '../doseCycle'
import { frequencyDailyFactor } from '../adherenceLogic'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const p = (over: Record<string, unknown>) => ({ time_schedule: ['08:00'], weekdays: [], ...over })

describe('getDoseCycle + cycleDoseAmount — tabela aprovada pelo PO', () => {
  it('diário soma as tomadas do dia (850 mg 2x ⇒ 1.700/dia)', () => {
    const prot = p({ frequency: 'diário', time_schedule: ['08:00', '20:00'] })
    expect(getDoseCycle(prot)).toEqual({ days: 1, suffix: '/dia' })
    expect(cycleDoseAmount(prot, 850)).toBe(1700)
  })

  it('semanal ⇒ total por semana', () => {
    const prot = p({ frequency: 'semanal', weekdays: ['sábado'] })
    expect(getDoseCycle(prot)).toEqual({ days: 7, suffix: '/semana' })
    expect(cycleDoseAmount(prot, 2.4)).toBe(2.4)
  })

  it('personalizado ⇒ total por semana (3 dias × 10 = 30)', () => {
    const prot = p({ frequency: 'personalizado', weekdays: ['segunda', 'quarta', 'sexta'] })
    expect(getDoseCycle(prot)?.suffix).toBe('/semana')
    expect(cycleDoseAmount(prot, 10)).toBe(30)
  })

  it('dias alternados ⇒ a cada 2 dias', () => {
    const prot = p({ frequency: 'dias_alternados' })
    expect(getDoseCycle(prot)).toEqual({ days: 2, suffix: ' a cada 2 dias' })
    expect(cycleDoseAmount(prot, 1)).toBe(1)
  })

  it('intervalo_dias ⇒ a cada N dias', () => {
    const prot = p({ frequency: 'intervalo_dias', interval_days: 90 })
    expect(getDoseCycle(prot)).toEqual({ days: 90, suffix: ' a cada 90 dias' })
    expect(cycleDoseAmount(prot, 1)).toBe(1)
  })
})

describe('doseCycle — modos degenerados', () => {
  it('PRN, frequência desconhecida e N inválido ⇒ sem ciclo', () => {
    for (const prot of [
      p({ frequency: 'quando_necessário' }),
      p({ frequency: 'quinzenal' }),
      p({ frequency: 'intervalo_dias', interval_days: null }),
      p({ frequency: 'intervalo_dias', interval_days: 1 }),
      null,
    ]) {
      expect(getDoseCycle(prot as never)).toBeNull()
      expect(cycleDoseAmount(prot as never, 1)).toBeNull()
    }
  })

  it('time_schedule vazio conta 1 tomada; personalizado sem dias conta 7; dose NaN ⇒ null', () => {
    expect(scheduleTimesPerDay(p({ time_schedule: [] }))).toBe(1)
    expect(cycleDoseAmount(p({ frequency: 'personalizado', weekdays: [] }), 1)).toBe(7)
    expect(cycleDoseAmount(p({ frequency: 'diário' }), Number.NaN)).toBeNull()
  })

  it('invariante com o estoque: ciclo / dias === diária × frequencyDailyFactor', () => {
    const cases = [
      p({ frequency: 'diário', time_schedule: ['08:00', '20:00'] }),
      p({ frequency: 'semanal', weekdays: ['sábado'] }),
      p({ frequency: 'personalizado', weekdays: ['segunda', 'quarta'] }),
      p({ frequency: 'personalizado', weekdays: [] }),
      p({ frequency: 'dias_alternados', time_schedule: ['08:00', '20:00'] }),
      p({ frequency: 'intervalo_dias', interval_days: 30 }),
    ]
    for (const prot of cases) {
      const cycle = getDoseCycle(prot)!
      const perDay = 3 * scheduleTimesPerDay(prot) * frequencyDailyFactor(prot)
      expect(cycleDoseAmount(prot, 3)! / cycle.days).toBeCloseTo(perDay, 10)
    }
  })
})
