// protocolActiveParity.test.ts — spec 088: o servidor NÃO tem mais motor de recorrência próprio. Os 3
// chamadores (lembrete legado, /hoje, digest) decidem por `isProtocolActiveOnDate` do core — os testes
// de cada chamador estão em server/bot/__tests__/*Recurrence.test.ts. Aqui fica a trava de que os
// apelidos que o antigo motor do servidor aceitava continuam aceitos (FR-006) e as decisões que eram
// "divergências declaradas" na 085 passam a ter UMA resposta, a do core (FR-005, FR-007).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { isProtocolActiveOnDate } from '@dosiq/core'

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

// Apelidos do antigo `protocolActiveHelper.ts` (removido na 088), com o calendário esperado em
// 2026-05-01 (sex) … 2026-05-06 (qua). Valor que o core deixar de reconhecer cai no fallback `true`
// e quebra as linhas de semanal/alternado — o teste fica vermelho, não silencioso.
const DATES = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06']
const SERVER_ALIASES: Array<[string, boolean[]]> = [
  ['diário', [true, true, true, true, true, true]],
  ['diariamente', [true, true, true, true, true, true]],
  ['daily', [true, true, true, true, true, true]],
  ['semanal', [false, false, false, true, false, true]],
  ['semanalmente', [false, false, false, true, false, true]],
  ['weekly', [false, false, false, true, false, true]],
  ['dias_alternados', [true, false, true, false, true, false]],
  ['dia_sim_dia_nao', [true, false, true, false, true, false]],
  ['every_other_day', [true, false, true, false, true, false]],
  ['alternating', [true, false, true, false, true, false]],
]

describe('apelidos do antigo motor do servidor ∈ FREQUENCY_MATCHERS (FR-006)', () => {
  it.each(SERVER_ALIASES)('%s', (frequency, expected) => {
    const p = { ...base, frequency }
    expect(DATES.map((d) => isProtocolActiveOnDate(p, d))).toEqual(expected)
  })

  it('caixa alta (o servidor fazia toLowerCase) segue aceita', () => {
    expect(isProtocolActiveOnDate({ ...base, frequency: 'SEMANAL' }, '2026-05-02')).toBe(false)
    expect(isProtocolActiveOnDate({ ...base, frequency: 'SEMANAL' }, '2026-05-04')).toBe(true)
  })
})

describe('decisões que eram divergências na 085 — agora uma resposta só (FR-005/007)', () => {
  it('frequência desconhecida: true (fallback audível, Q-2)', () => {
    expect(isProtocolActiveOnDate({ ...base, frequency: 'quinzenal' }, '2026-05-02')).toBe(true)
  })

  it('período: end_date passado exclui', () => {
    expect(isProtocolActiveOnDate({ ...base, frequency: 'diário', end_date: '2026-05-05' }, '2026-05-10')).toBe(false)
  })

  it('intervalo_dias N=30 em 70 dias: 1/5, 31/5, 30/6', () => {
    const p = { ...base, frequency: 'intervalo_dias', interval_days: 30 }
    const days = Array.from({ length: 70 }, (_, i) => {
      const d = new Date(2026, 4, 1 + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    expect(days.filter((d) => isProtocolActiveOnDate(p, d))).toEqual(['2026-05-01', '2026-05-31', '2026-06-30'])
  })

  it('intervalo_dias com N ausente (select sem a coluna): audível', () => {
    expect(isProtocolActiveOnDate({ ...base, frequency: 'intervalo_dias', interval_days: null }, '2026-05-02')).toBe(true)
  })
})
