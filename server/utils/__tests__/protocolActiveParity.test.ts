// protocolActiveParity.test.ts — 085 Slice B (analysis-b §3a): o servidor tem um SEGUNDO motor de
// recorrência (`isProtocolActiveOnWeekday`) usado pelo lembrete legado, /hoje e digest. Este teste
// TRAVA a paridade com o core onde ela existe e DECLARA onde ela não existe. Consolidar os dois
// motores é a spec 088 (recurrence-engine) — não este slice.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isProtocolActiveOnDate } from '@dosiq/core'
import { isProtocolActiveOnWeekday } from '../protocolActiveHelper.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const base = {
  id: 'p1',
  active: true,
  start_date: '2026-05-01',
  end_date: null,
  time_schedule: ['08:00'],
  weekdays: ['segunda', 'quarta'],
}

// 14 dias a partir do start_date (datas locais, AP-270). 2026-05-01 é sexta.
const DATES = Array.from({ length: 14 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`)
const weekdayOf = (d: string) => new Date(`${d}T12:00:00`).getDay()

describe('paridade core × servidor — frequências do enum', () => {
  it.each(['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário'])(
    '%s: os dois motores concordam em todos os dias',
    (frequency) => {
      const p = { ...base, frequency }
      for (const d of DATES) {
        expect([d, isProtocolActiveOnWeekday(p, weekdayOf(d), d)]).toEqual([d, isProtocolActiveOnDate(p, d)])
      }
    }
  )
})

describe('divergências DECLARADAS (spec 088 §2) — mudar qualquer uma é decisão, não acidente', () => {
  it('frequência desconhecida: servidor false, core true', () => {
    const p = { ...base, frequency: 'quinzenal' }
    expect(isProtocolActiveOnWeekday(p, weekdayOf('2026-05-02'), '2026-05-02')).toBe(false)
    expect(isProtocolActiveOnDate(p, '2026-05-02')).toBe(true)
  })

  it('período: servidor não confere end_date, core confere', () => {
    const p = { ...base, frequency: 'diário', end_date: '2026-05-05' }
    expect(isProtocolActiveOnWeekday(p, weekdayOf('2026-05-10'), '2026-05-10')).toBe(true)
    expect(isProtocolActiveOnDate(p, '2026-05-10')).toBe(false)
  })
})
