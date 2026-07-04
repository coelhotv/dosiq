import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  buildTimeline,
  groupByLocalDay,
  deriveLocalDay,
  TIMELINE_ORDER,
  TIMELINE_EVENT_TYPES,
} from '../timeline'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

// Helpers de fixture — instantes absolutos em UTC.
const ev = (id, occurred_at, type = 'dose', payload = {}) => ({ id, type, occurred_at, payload })

describe('deriveLocalDay', () => {
  it('deriva dia local em SP (UTC-3)', () => {
    // 02:50Z = 23:50 do dia anterior em SP
    expect(deriveLocalDay('2026-05-28T02:50:00Z', 'America/Sao_Paulo')).toBe('2026-05-27')
  })

  it('mesmo instante rende dia diferente em fuso ≠ SP', () => {
    // 02:50Z = 03:50 em Londres (BST, UTC+1) → dia 28
    expect(deriveLocalDay('2026-05-28T02:50:00Z', 'Europe/London')).toBe('2026-05-28')
  })

  it('default é São Paulo', () => {
    expect(deriveLocalDay('2026-05-28T02:50:00Z')).toBe('2026-05-27')
  })

  it('retorna null para instante inválido', () => {
    expect(deriveLocalDay('not-a-date')).toBeNull()
  })

  it('respeita DST do fuso (NY) — antes vs depois da virada', () => {
    // 2026-03-08 02:00 local NY = início do DST (EST→EDT)
    // 06:30Z em março: EST (UTC-5) → 01:30 dia 8
    expect(deriveLocalDay('2026-03-08T06:30:00Z', 'America/New_York')).toBe('2026-03-08')
    // julho: EDT (UTC-4) → 02:30Z = 22:30 do dia anterior
    expect(deriveLocalDay('2026-07-08T02:30:00Z', 'America/New_York')).toBe('2026-07-07')
  })
})

describe('buildTimeline — ordenação por instante absoluto', () => {
  it('ordena desc (mais recente primeiro) por default', () => {
    const out = buildTimeline([
      ev('a', '2026-05-20T10:00:00Z'),
      ev('b', '2026-05-22T10:00:00Z'),
      ev('c', '2026-05-21T10:00:00Z'),
    ])
    expect(out.map(e => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('ordena asc quando solicitado', () => {
    const out = buildTimeline([
      ev('a', '2026-05-20T10:00:00Z'),
      ev('b', '2026-05-22T10:00:00Z'),
      ev('c', '2026-05-21T10:00:00Z'),
    ], { order: TIMELINE_ORDER.ASC })
    expect(out.map(e => e.id)).toEqual(['a', 'c', 'b'])
  })

  it('desempata por id de forma determinística quando instante coincide', () => {
    const sameTs = '2026-05-20T10:00:00Z'
    const out1 = buildTimeline([ev('z', sameTs), ev('a', sameTs), ev('m', sameTs)])
    const out2 = buildTimeline([ev('a', sameTs), ev('m', sameTs), ev('z', sameTs)])
    expect(out1.map(e => e.id)).toEqual(out2.map(e => e.id))
    expect(out1.map(e => e.id)).toEqual(['a', 'm', 'z'])
  })

  it('não muta os eventos de entrada', () => {
    const input = [ev('a', '2026-05-20T10:00:00Z')]
    buildTimeline(input)
    expect((input[0] as any).localDay).toBeUndefined()
  })

  it('anexa localDay derivado no tz informado', () => {
    const [e] = buildTimeline([ev('a', '2026-05-28T02:50:00Z')], { tz: 'Europe/London' })
    expect(e.localDay).toBe('2026-05-28')
  })
})

describe('buildTimeline — robustez', () => {
  it('retorna [] para entrada não-array', () => {
    expect(buildTimeline(null)).toEqual([])
    expect(buildTimeline(undefined)).toEqual([])
    expect(buildTimeline({})).toEqual([])
  })

  it('descarta eventos sem occurred_at ou com instante inválido', () => {
    const out = buildTimeline([
      ev('ok', '2026-05-20T10:00:00Z'),
      { id: 'no-ts', type: 'dose', payload: {} },
      ev('bad', 'lixo'),
      null,
    ])
    expect(out.map(e => e.id)).toEqual(['ok'])
  })
})

describe('buildTimeline — cross-meia-noite e mix de tipos', () => {
  it('dose 23:50 e 00:10 caem em dias locais distintos mas adjacentes na stream', () => {
    // 23:50 SP dia 27 = 2026-05-28T02:50Z ; 00:10 SP dia 28 = 2026-05-28T03:10Z
    const out = buildTimeline([
      ev('antes', '2026-05-28T02:50:00Z'),
      ev('depois', '2026-05-28T03:10:00Z'),
    ], { order: TIMELINE_ORDER.ASC })
    expect(out.map(e => e.id)).toEqual(['antes', 'depois'])
    expect(out[0].localDay).toBe('2026-05-27')
    expect(out[1].localDay).toBe('2026-05-28')
  })

  it('builder é agnóstico a tipo — ordena dose + note (tipo fake) juntos por instante', () => {
    const out = buildTimeline([
      ev('d1', '2026-05-20T10:00:00Z', TIMELINE_EVENT_TYPES.DOSE),
      ev('n1', '2026-05-20T11:00:00Z', 'note', { text: 'tipo futuro' }),
      ev('d2', '2026-05-20T09:00:00Z', TIMELINE_EVENT_TYPES.DOSE),
    ], { order: TIMELINE_ORDER.ASC })
    expect(out.map(e => e.id)).toEqual(['d2', 'd1', 'n1'])
    expect(out.map(e => e.type)).toEqual(['dose', 'dose', 'note'])
  })
})

describe('groupByLocalDay', () => {
  it('agrupa por dia local preservando ordem absoluta', () => {
    const built = buildTimeline([
      ev('a', '2026-05-28T03:10:00Z'), // 00:10 SP dia 28
      ev('b', '2026-05-28T02:50:00Z'), // 23:50 SP dia 27
      ev('c', '2026-05-27T13:00:00Z'), // 10:00 SP dia 27
    ], { order: TIMELINE_ORDER.DESC })
    const groups = groupByLocalDay(built)
    expect(groups.map(g => g.localDay)).toEqual(['2026-05-28', '2026-05-27'])
    expect(groups[0].events.map(e => e.id)).toEqual(['a'])
    expect(groups[1].events.map(e => e.id)).toEqual(['b', 'c'])
  })

  it('retorna [] para entrada não-array', () => {
    expect(groupByLocalDay(null)).toEqual([])
  })
})
