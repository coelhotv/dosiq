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

  it('considera wrap-around da meia-noite (00:30 e 23:30 → janela real 60min → tol 30)', () => {
    // mesmo dia o gap parece 1380min, mas na virada são 60min → tolerância 30, sem sobrepor
    const out = generateInstances(
      { ...baseProtocol, time_schedule: ['00:30', '23:30'] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.map((i) => i.tolerance_minutes)).toEqual([30, 30])
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

  // ── ADR-061 / FR-007 (012 Fase B): não-diário frequency-aware, SEM cap de 120 ──

  it('semanal dose única: tolerância = metade do período (5040min = 3,5 dias), sem cap', () => {
    // Perdão clínico do GLP-1 semanal: 5040min = 84h — cobre o perdão de 72h da bula.
    const out = generateInstances(
      {
        ...baseProtocol,
        frequency: 'semanal',
        weekdays: ['domingo'],
        time_schedule: ['08:00'],
      },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out[0].tolerance_minutes).toBe(5040)
  })

  it('dias_alternados dose única: metade de 48h (1440min), sem cap', () => {
    const out = generateInstances(
      { ...baseProtocol, frequency: 'dias_alternados', time_schedule: ['08:00'] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out[0].tolerance_minutes).toBe(1440)
  })

  it('semanal multi-dose: metade do menor gap adjacente, acima de 120 sem cap', () => {
    // 08:00/20:00 no mesmo dia: gap intra-dia 720min → 360. Cap de 120 NÃO se aplica.
    const out = generateInstances(
      {
        ...baseProtocol,
        frequency: 'semanal',
        weekdays: ['domingo'],
        time_schedule: ['08:00', '20:00'],
      },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.map((i) => i.tolerance_minutes)).toEqual([360, 360])
  })

  it('frequência sem período mapeado: mantém 120 fixo (legado)', () => {
    // 'mensal' não existe no FREQUENCY_PERIOD_MINUTES → fallback legado 120.
    // (personalizado/PRN nunca materializam instâncias — matcher false.)
    const out = generateInstances(
      { ...baseProtocol, frequency: 'mensal', time_schedule: ['08:00'] },
      '2026-05-10T00:00:00-03:00',
      '2026-05-10T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out[0].tolerance_minutes).toBe(120)
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

// ── 012 Fase B (FR-006/FP-1): expected_dose congela a etapa de titulação vigente ──
describe('generateInstances — titulação congela expected_dose por etapa', () => {
  const glp1Protocol = {
    id: 'p-glp1',
    user_id: 'u1',
    frequency: 'semanal',
    weekdays: ['domingo'],
    time_schedule: ['08:00'],
    dosage_per_intake: 1,
    start_date: '2026-06-01',
    active: true,
    titration_schedule: [
      { days: 28, dosage: 0.25 },
      { days: 28, dosage: 0.5 },
    ],
    current_stage_index: 0,
    stage_started_at: '2026-06-01T08:00:00.000Z',
    titration_status: 'titulando',
  }

  it('instâncias futuras nascem com a dose da etapa vigente NA DATA (não a atual)', () => {
    // Janela cruza a fronteira da etapa 1 (28d → 2026-06-29): domingos 07/06..05/07
    const out = generateInstances(
      glp1Protocol,
      '2026-06-01T00:00:00-03:00',
      '2026-07-05T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.length).toBeGreaterThanOrEqual(4)
    const byDate = Object.fromEntries(out.map((i) => [i.scheduled_for.slice(0, 10), i.expected_dose]))
    expect(byDate['2026-06-07']).toBe(0.25) // etapa 1
    expect(byDate['2026-06-28']).toBe(0.25) // último domingo da etapa 1
    expect(byDate['2026-07-05']).toBe(0.5)  // etapa 2 (após 29/06)
  })

  it('sem titulação ativa (estável) → dosage_per_intake chapado', () => {
    const out = generateInstances(
      { ...glp1Protocol, titration_status: 'estável' },
      '2026-06-01T00:00:00-03:00',
      '2026-07-05T23:59:59-03:00',
      'America/Sao_Paulo'
    )
    expect(out.every((i) => i.expected_dose === 1)).toBe(true)
  })
})
