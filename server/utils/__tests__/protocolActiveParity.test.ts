// protocolActiveParity.test.ts — 085 Slice B (analysis-b §3a): o servidor tem um SEGUNDO motor de
// recorrência (`isProtocolActiveOnWeekday`) usado pelo lembrete legado, /hoje e digest. Este teste
// TRAVA a paridade com o core onde ela existe e DECLARA onde ela não existe. Consolidar os dois
// motores é a spec 088 (recurrence-engine) — não este slice.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isProtocolActiveOnDate, FREQUENCIES } from '@dosiq/core'
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
  // 085 C1: itera o ENUM do core, não uma lista literal — valor novo no CHECK sem ramo no servidor
  // fica vermelho aqui (foi assim que `intervalo_dias` quase nasceu silencioso no servidor, H-2).
  it.each([...FREQUENCIES])(
    '%s: os dois motores concordam em todos os dias',
    (frequency) => {
      const p = { ...base, frequency, interval_days: frequency === 'intervalo_dias' ? 3 : null }
      for (const d of DATES) {
        expect([d, isProtocolActiveOnWeekday(p, weekdayOf(d), d)]).toEqual([d, isProtocolActiveOnDate(p, d)])
      }
    }
  )
})

describe('paridade core × servidor — intervalo_dias (085 C1 / H-2)', () => {
  it('N=30 em 70 dias: mesmos dias nos dois motores (1/5, 31/5, 30/6)', () => {
    const p = { ...base, frequency: 'intervalo_dias', interval_days: 30 }
    const days = Array.from({ length: 70 }, (_, i) => {
      const d = new Date(2026, 4, 1 + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    const server = days.filter((d) => isProtocolActiveOnWeekday(p, weekdayOf(d), d))
    const core = days.filter((d) => isProtocolActiveOnDate(p, d))
    expect(server).toEqual(['2026-05-01', '2026-05-31', '2026-06-30'])
    expect(core).toEqual(server)
  })

  it('N ausente (select sem a coluna): os dois motores erram para o lado audível', () => {
    const p = { ...base, frequency: 'intervalo_dias', interval_days: null }
    expect(isProtocolActiveOnWeekday(p, weekdayOf('2026-05-02'), '2026-05-02')).toBe(true)
    expect(isProtocolActiveOnDate(p, '2026-05-02')).toBe(true)
  })
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
