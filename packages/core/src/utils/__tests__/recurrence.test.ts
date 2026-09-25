// recurrence.test.ts — 085 Slice B: recorrência por frequência (quantos dias), não tolerância.
// Cada valor de FREQUENCIES tem um caso; a mutação de controle (tirar `dias_alternados` do
// FREQUENCY_MATCHERS) tem de deixar o PO-4 vermelho — senão o teste mede o fallback.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateInstances } from '../doseInstanceGenerator'
import {
  isProtocolActiveOnDate,
  isKnownFrequency,
  getNextOccurrence,
  describeNextOccurrence,
} from '../adherenceLogic'
import { FREQUENCIES } from '../../schemas/protocolSchema'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const TZ = 'America/Sao_Paulo'

// 2026-05-01 é sexta-feira. Datas locais, nunca derivadas de toISOString (AP-270).
const baseProtocol = {
  id: 'p1',
  user_id: 'u1',
  frequency: 'diário',
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  start_date: '2026-05-01',
  end_date: null,
  active: true,
  weekdays: ['segunda', 'quarta'],
}

/** Dias locais (YYYY-MM-DD) das instâncias geradas numa janela de 14 dias a partir do start_date. */
function fourteenDayDates(frequency: string): string[] {
  const out = generateInstances(
    // 085 C1: `intervalo_dias` exige N (coerência do CHECK); as demais levam NULL.
    { ...baseProtocol, frequency, interval_days: frequency === 'intervalo_dias' ? 3 : null },
    '2026-05-01T00:00:00-03:00',
    '2026-05-14T23:59:59-03:00',
    TZ
  )
  return out.map((i) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(i.scheduled_for)
    )
  )
}

describe('085 PO-4 — dias_alternados gera em dia alternado, não todo dia', () => {
  it('7 instâncias em 14 dias, nas datas de paridade par a partir do start_date', () => {
    expect(fourteenDayDates('dias_alternados')).toEqual([
      '2026-05-01',
      '2026-05-03',
      '2026-05-05',
      '2026-05-07',
      '2026-05-09',
      '2026-05-11',
      '2026-05-13',
    ])
  })
})

describe('085 PO-5 — recorrência por valor de FREQUENCIES (janela fixa de 14 dias)', () => {
  // Um caso por valor do enum. Valor novo sem entrada aqui falha no teste de cobertura abaixo.
  const EXPECTED_COUNT: Record<string, number> = {
    diário: 14,
    dias_alternados: 7,
    semanal: 4, // seg 04, qua 06, seg 11, qua 13
    personalizado: 0, // depreciado (Slice A); matcher constante `false`, declarado
    quando_necessário: 0, // PRN nunca gera
    intervalo_dias: 5, // 085 C1, N=3: 01, 04, 07, 10, 13
  }

  it('todo valor de FREQUENCIES tem contagem esperada declarada', () => {
    expect([...FREQUENCIES].sort()).toEqual(Object.keys(EXPECTED_COUNT).sort())
  })

  it.each(Object.entries(EXPECTED_COUNT))('%s → %i ocorrências', (frequency, count) => {
    expect(fourteenDayDates(frequency)).toHaveLength(count)
  })
})

describe('085 PO-6 — frequência desconhecida tem comportamento declarado', () => {
  it('SC-003: nenhum valor do enum cai no fallback', () => {
    for (const f of FREQUENCIES) expect(isKnownFrequency(f)).toBe(true)
  })

  it('valor fora do enum é reconhecível como desconhecido', () => {
    expect(isKnownFrequency('quinzenal')).toBe(false)
    expect(isKnownFrequency(null)).toBe(false)
  })

  it('desconhecido é tratado como ativo — não silencia (declarado, ver _matchesFrequency)', () => {
    expect(isProtocolActiveOnDate({ ...baseProtocol, frequency: 'quinzenal' }, '2026-05-02')).toBe(true)
  })

  it('caixa diferente de um valor conhecido casa o matcher, não o fallback', () => {
    expect(isKnownFrequency('Dias_Alternados')).toBe(true)
    expect(isProtocolActiveOnDate({ ...baseProtocol, frequency: 'Dias_Alternados' }, '2026-05-02')).toBe(false)
  })
})

describe('085 dias_alternados — modos de falha do matcher', () => {
  it('data anterior ao start_date nunca casa', () => {
    expect(isProtocolActiveOnDate({ ...baseProtocol, frequency: 'dias_alternados' }, '2026-04-29')).toBe(false)
  })

  it('sem start_date mantém o comportamento anterior (ativo)', () => {
    expect(isProtocolActiveOnDate({ ...baseProtocol, frequency: 'dias_alternados', start_date: null }, '2026-05-02')).toBe(true)
  })

  it('paridade estável através de virada de mês e de ano', () => {
    const p = { ...baseProtocol, frequency: 'dias_alternados', start_date: '2026-12-30' }
    expect(isProtocolActiveOnDate(p, '2027-01-01')).toBe(true) // +2
    expect(isProtocolActiveOnDate(p, '2027-01-02')).toBe(false) // +3
    expect(isProtocolActiveOnDate(p, '2027-03-01')).toBe(false) // +61
  })
})

describe('085 PO-7 — D-1: pausa ímpar não reancora a alternância', () => {
  const alt = { ...baseProtocol, frequency: 'dias_alternados' }

  it('retomada em dia ímpar: a 1ª dose é no dia seguinte, paridade do start_date', () => {
    // Pausado de 05-07 a 05-10 (3 dias, ímpar). Retoma 05-10 09:00 — diff 9 do start: sem dose.
    const out = generateInstances(alt, '2026-05-10T09:00:00-03:00', '2026-05-16T23:59:59-03:00', TZ)
    const days = out.map((i) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
        new Date(i.scheduled_for)
      )
    )
    expect(days).toEqual(['2026-05-11', '2026-05-13', '2026-05-15'])
  })

  it('FR-008a: a próxima dose informada na retomada é a do motor', () => {
    const now = new Date(2026, 4, 10, 9, 0) // 10/05 09:00 local
    expect(getNextOccurrence({ ...alt, active: false }, now)).toEqual({ date: '2026-05-11', time: '08:00' })
  })
})

describe('085 FR-008a — getNextOccurrence / describeNextOccurrence', () => {
  const now = new Date(2026, 4, 11, 9, 0) // segunda 11/05 09:00

  it('hoje, próximo horário ainda por vir', () => {
    const p = { ...baseProtocol, time_schedule: ['08:00', '20:00'] }
    expect(getNextOccurrence(p, now)).toEqual({ date: '2026-05-11', time: '20:00' })
  })

  it('todos os horários de hoje passaram → próximo dia de dose', () => {
    expect(getNextOccurrence(baseProtocol, now)).toEqual({ date: '2026-05-12', time: '08:00' })
  })

  it('semanal pula para o próximo dia da semana marcado', () => {
    expect(getNextOccurrence({ ...baseProtocol, frequency: 'semanal' }, now)).toEqual({ date: '2026-05-13', time: '08:00' })
  })

  it('PRN, depreciado e sem horários → null', () => {
    expect(getNextOccurrence({ ...baseProtocol, frequency: 'quando_necessário' }, now)).toBeNull()
    expect(getNextOccurrence({ ...baseProtocol, frequency: 'personalizado' }, now)).toBeNull()
    expect(getNextOccurrence({ ...baseProtocol, time_schedule: [] }, now)).toBeNull()
  })

  it('end_date antes da próxima ocorrência → null', () => {
    expect(getNextOccurrence({ ...baseProtocol, end_date: '2026-05-11' }, now)).toBeNull()
  })

  it('descreve hoje, amanhã e data com dia da semana', () => {
    expect(describeNextOccurrence({ date: '2026-05-11', time: '20:00' }, now)).toBe('hoje às 20:00')
    expect(describeNextOccurrence({ date: '2026-05-12', time: '08:00' }, now)).toBe('amanhã às 08:00')
    expect(describeNextOccurrence({ date: '2026-05-13', time: '08:00' }, now)).toBe('qua, 13/05 às 08:00')
  })
})
