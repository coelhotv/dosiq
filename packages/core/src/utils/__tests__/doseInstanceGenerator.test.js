import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateInstances } from '../doseInstanceGenerator.js'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

// Helpers ------------------------------------------------------------------
const baseProtocol = {
  id: 'p1',
  user_id: 'u1',
  frequency: 'diário',
  time_schedule: ['08:00', '22:30'],
  dosage_per_intake: 2,
  start_date: '2026-01-01',
  end_date: null,
  active: true,
}

/** Extrai wall-clock HH:MM no fuso a partir do ISO gerado. */
function wallClock(iso, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

describe('generateInstances — recorrência diária', () => {
  it('gera 2 slots/dia para janela de 1 dia (SP)', () => {
    const out = generateInstances(
      baseProtocol,
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out).toHaveLength(2)
    expect(out.map((i) => wallClock(i.scheduled_for, 'America/Sao_Paulo'))).toEqual(['08:00', '22:30'])
    expect(out.every((i) => i.expected_dose === 2)).toBe(true)
    expect(out.every((i) => i.protocol_id === 'p1' && i.user_id === 'u1')).toBe(true)
  })

  it('ordena por scheduled_for absoluto', () => {
    const out = generateInstances(
      baseProtocol,
      '2026-05-10T00:00:00-03:00',
      '2026-05-12T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    const sorted = [...out].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
    expect(out).toEqual(sorted)
    expect(out).toHaveLength(6) // 3 dias × 2 slots
  })

  it('respeita os limites da janela (exclui fora de [from,to])', () => {
    // janela começa 09:00 → exclui o slot das 08:00 do dia 1
    const out = generateInstances(
      baseProtocol,
      '2026-05-10T09:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out).toHaveLength(1)
    expect(wallClock(out[0].scheduled_for, 'America/Sao_Paulo')).toBe('22:30')
  })
})

describe('generateInstances — timezone (multi-fuso)', () => {
  it('grava o mesmo wall-clock em fusos diferentes como instantes absolutos distintos', () => {
    const sp = generateInstances(
      { ...baseProtocol, time_schedule: ['08:00'] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    const manaus = generateInstances(
      { ...baseProtocol, time_schedule: ['08:00'] },
      '2026-05-10T00:00:00-04:00',
      '2026-05-10T23:59:59-04:00',
      'America/Manaus'
    )
    expect(wallClock(sp[0].scheduled_for, 'America/Sao_Paulo')).toBe('08:00')
    expect(wallClock(manaus[0].scheduled_for, 'America/Manaus')).toBe('08:00')
    // 08:00 SP (GMT-3) = 11:00Z; 08:00 Manaus (GMT-4) = 12:00Z → instantes distintos
    expect(sp[0].scheduled_for).not.toBe(manaus[0].scheduled_for)
    expect(new Date(manaus[0].scheduled_for).getTime()).toBeGreaterThan(
      new Date(sp[0].scheduled_for).getTime()
    )
  })

  it('dose das 22:30 cruza a meia-noite sem perder âncora ao dia correto', () => {
    // janela cobre dia 10 22:30 até dia 11 00:30 — o slot pertence ao dia 10
    const out = generateInstances(
      { ...baseProtocol, time_schedule: ['22:30'] },
      '2026-05-10T22:00:00-03:00',
      '2026-05-11T00:30:00-03:00',
      'America/Sao_Paulo'
    )
    expect(out).toHaveLength(1)
    expect(wallClock(out[0].scheduled_for, 'America/Sao_Paulo')).toBe('22:30')
    // confirma data local = 10, não 11
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(out[0].scheduled_for)
    )
    expect(localDate).toBe('2026-05-10')
  })
})

describe('generateInstances — tolerância dinâmica (§6)', () => {
  it('diário multi-dose: metade do menor intervalo adjacente, teto 120', () => {
    // slots 08:00 e 22:30 → gap 870min → metade 435 → teto 120
    const out = generateInstances(
      baseProtocol,
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.every((i) => i.tolerance_minutes === 120)).toBe(true)
  })

  it('slots próximos reduzem tolerância para não sobrepor janelas', () => {
    // 08:00 e 09:00 → gap 60 → metade 30
    const out = generateInstances(
      { ...baseProtocol, time_schedule: ['08:00', '09:00'] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.map((i) => i.tolerance_minutes)).toEqual([30, 30])
    // janelas não se sobrepõem: 08:00+30 = 08:30 <= 09:00-30 = 08:30 (toca, não sobrepõe)
  })

  it('três slots: cada um usa o menor adjacente', () => {
    // 08:00, 09:00 (gap 60→30), 12:00 (gap 180→90). slot do meio = min(30,90)=15? não:
    // 09:00 prev gap 60/2=30, next gap 180/2=90 → min=30
    const out = generateInstances(
      { ...baseProtocol, time_schedule: ['08:00', '09:00', '12:00'] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.map((i) => i.tolerance_minutes)).toEqual([30, 30, 90])
  })

  it('dose única diária: 120 fixo', () => {
    const out = generateInstances(
      { ...baseProtocol, time_schedule: ['08:00'] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out[0].tolerance_minutes).toBe(120)
  })

  it('semanal multi-dose: 120 fixo (não-diário não usa janela dinâmica)', () => {
    const out = generateInstances(
      {
        ...baseProtocol,
        frequency: 'semanal',
        weekdays: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'],
        time_schedule: ['08:00', '09:00'],
      },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.every((i) => i.tolerance_minutes === 120)).toBe(true)
  })
})

describe('generateInstances — casos de borda', () => {
  it('PRN (quando_necessário) não gera instâncias', () => {
    const out = generateInstances(
      { ...baseProtocol, frequency: 'quando_necessário' },
      '2026-05-10T00:00:00-03:00',
      '2026-05-12T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out).toEqual([])
  })

  it('respeita end_date (não gera após o fim)', () => {
    const out = generateInstances(
      { ...baseProtocol, end_date: '2026-05-10', time_schedule: ['08:00'] },
      '2026-05-09T00:00:00-03:00',
      '2026-05-15T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    const dates = out.map((i) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(i.scheduled_for))
    )
    expect(dates).toEqual(['2026-05-09', '2026-05-10'])
  })

  it('time_schedule vazio → []', () => {
    expect(generateInstances({ ...baseProtocol, time_schedule: [] }, '2026-05-10T00:00:00-03:00', '2026-05-10T23:59:59-03:00')).toEqual([])
  })

  it('protocolo nulo ou janela invertida → []', () => {
    expect(generateInstances(null, '2026-05-10', '2026-05-11')).toEqual([])
    expect(
      generateInstances(baseProtocol, '2026-05-12T00:00:00-03:00', '2026-05-10T00:00:00-03:00')
    ).toEqual([])
  })

  it('ignora horários malformados no time_schedule', () => {
    const out = generateInstances(
      { ...baseProtocol, time_schedule: ['08:00', 'xx:yy', null] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out).toHaveLength(1)
    expect(wallClock(out[0].scheduled_for, 'America/Sao_Paulo')).toBe('08:00')
  })
})
