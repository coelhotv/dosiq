// upcomingDoseDates.test.ts — 086 PO-6: a prévia das próximas datas É o que o gerador de instâncias
// produz a partir de AGORA (RC3 E-1/E-2, INV-3). O oráculo é `generateInstances` real — nunca uma
// lista escrita à mão (boundary do PO-6).
//
// Fuso (C1.5 G-3): a prévia usa o relógio local do processo (como `getNextOccurrence`); o gerador
// recebe `tz` explícito. O teste passa ao gerador o fuso DO PROCESSO, então a comparação vale em
// qualquer máquina (Mac em São Paulo, CI em UTC). Datas de fixture locais, nunca toISOString (AP-270).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateInstances } from '../doseInstanceGenerator'
import { listUpcomingDoseDates } from '../adherenceLogic'
import { formatLocalDate } from '../dateUtils'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const PROC_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
const localDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: PROC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso)
  )

// Agora = 10/out/2026 14:00 local. 08:00 já passou hoje; 20:00 ainda vem.
const NOW = new Date(2026, 9, 10, 14, 0, 0, 0)
const TODAY = formatLocalDate(NOW)

function shiftDays(days: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days)
  return formatLocalDate(d)
}

function protocolOf({ n, start, time = '08:00', end = null }: { n: number; start: string; time?: string; end?: string | null }) {
  return {
    id: 'p-1',
    user_id: 'u-1',
    frequency: 'intervalo_dias',
    interval_days: n,
    time_schedule: [time],
    dosage_per_intake: 1,
    start_date: start,
    end_date: end,
    active: true,
    weekdays: [],
  }
}

/** Oráculo: datas locais distintas das instâncias que o gerador cria de `now` em diante. */
function generatorDates(protocol: ReturnType<typeof protocolOf>, count = 3): string[] {
  const horizonEnd = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + 800, 23, 59)
  const days = generateInstances(protocol, NOW, horizonEnd, PROC_TZ).map((i) => localDay(i.scheduled_for))
  return [...new Set(days)].slice(0, count)
}

const ANCHORS: Array<[string, (n: number) => string, string]> = [
  ['âncora passada', (n) => shiftDays(-(n + 3)), '08:00'],
  ['âncora hoje, horário por vir', () => TODAY, '20:00'],
  ['âncora hoje, horário passado', () => TODAY, '08:00'],
  ['âncora futura (+10 d)', () => shiftDays(10), '08:00'],
]

describe('086 PO-6 — prévia = gerador a partir de agora', () => {
  for (const n of [2, 7, 30, 45, 180]) {
    for (const [label, anchorOf, time] of ANCHORS) {
      it(`N=${n} · ${label} · sem término`, () => {
        const p = protocolOf({ n, start: anchorOf(n), time })
        const expected = generatorDates(p)
        expect(expected).toHaveLength(3) // o oráculo não pode estar vazio (senão o teste passa medindo nada)
        expect(listUpcomingDoseDates(p, 3, NOW).dates).toEqual(expected)
      })

      it(`N=${n} · ${label} · término corta a série`, () => {
        const start = anchorOf(n)
        const first = generatorDates(protocolOf({ n, start, time }))[0]
        // término no dia da 1ª ocorrência: série de 1 data
        const p = protocolOf({ n, start, time, end: first })
        const expected = generatorDates(p)
        expect(expected).toEqual([first])
        expect(listUpcomingDoseDates(p, 3, NOW).dates).toEqual(expected)
      })
    }
  }

  it('E-2: N=180 com âncora daqui a 60 dias → 3 datas (horizonte calculado, não 400 fixo)', () => {
    const p = protocolOf({ n: 180, start: shiftDays(60) })
    const expected = generatorDates(p)
    expect(expected).toHaveLength(3)
    expect(listUpcomingDoseDates(p, 3, NOW).dates).toEqual(expected)
  })

  it('E-1: âncora hoje com horário passado → hoje fora da prévia e todayDropped', () => {
    const p = protocolOf({ n: 30, start: TODAY, time: '08:00' })
    const out = listUpcomingDoseDates(p, 3, NOW)
    expect(out.dates[0]).not.toBe(TODAY)
    expect(out.dates[0]).toBe(shiftDays(30))
    expect(out.todayDropped).toBe(true)
  })

  it('âncora hoje com horário por vir → hoje é a 1ª data e todayDropped false', () => {
    const out = listUpcomingDoseDates(protocolOf({ n: 30, start: TODAY, time: '20:00' }), 3, NOW)
    expect(out.dates[0]).toBe(TODAY)
    expect(out.todayDropped).toBe(false)
  })

  it('degenerados: sem horário, PRN, término no passado, protocolo nulo → nenhuma data', () => {
    expect(listUpcomingDoseDates({ ...protocolOf({ n: 30, start: TODAY }), time_schedule: [] }, 3, NOW).dates).toEqual([])
    expect(
      listUpcomingDoseDates({ ...protocolOf({ n: 30, start: TODAY }), frequency: 'quando_necessário' }, 3, NOW).dates
    ).toEqual([])
    expect(listUpcomingDoseDates(protocolOf({ n: 30, start: shiftDays(-90), end: shiftDays(-1) }), 3, NOW).dates).toEqual([])
    expect(listUpcomingDoseDates(null, 3, NOW)).toEqual({ dates: [], todayDropped: false })
  })
})
