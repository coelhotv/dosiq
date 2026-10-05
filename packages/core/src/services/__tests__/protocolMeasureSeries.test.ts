// Ponte tratamento/escada → série (069 Ba · PO-10, PO-17). Datas locais literais; instantes com
// offset -03 explícito (AP-270).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { daysBetween, shiftDay } from '../report/reportFormat'
import {
  buildProtocolMeasureSeries,
  ladderStepDays,
  protocolMeasureWindowStart,
  splitDayWindow,
  type BuildProtocolMeasureSeriesArgs,
  type MeasureBridgeDoseDay,
  type MeasureBridgeMedicine,
  type MeasureBridgeProtocol,
  type MeasureBridgeStepRow,
} from '../protocolMeasureSeries'

const TZ = 'America/Sao_Paulo'

const MOUN: MeasureBridgeMedicine = {
  id: 'm_moun',
  presentation: 'injetavel',
  dosage_unit: 'mg/ml',
  dosage_per_pill: 10,
  units_per_ml: null,
  concentration_volume_ml: 0.5,
}
const MET: MeasureBridgeMedicine = {
  id: 'm_met',
  presentation: 'comprimido',
  dosage_unit: 'mg',
  dosage_per_pill: 850,
  units_per_ml: null,
  concentration_volume_ml: null,
}

const PROTO: MeasureBridgeProtocol = {
  id: 'p_moun',
  medicine_id: 'm_moun',
  frequency: 'semanal',
  intake_unit: 'mg',
  dosage_per_intake: 5,
  start_date: '2026-08-01',
}

const step = (over: Partial<MeasureBridgeStepRow> & { position: number }): MeasureBridgeStepRow => ({
  medicine_id: 'm_moun',
  dose: 2.5,
  intake_unit: 'mg',
  duration_days: 28,
  status: 'completed',
  started_at: null,
  ended_at: null,
  ...over,
})

const peso = (day: string, kg: number, hour = '07:00') => ({ type: 'peso', value: kg, measured_at: `${day}T${hour}:00-03:00` })

const doseDay = (protocol_id: string | null, day: string, taken: number, missed = 0): MeasureBridgeDoseDay => ({
  protocol_id,
  day,
  taken_count: taken,
  missed_count: missed,
})

const LADDER = [
  step({ position: 1, dose: 2.5, started_at: '2026-08-01T09:00:00-03:00', ended_at: '2026-08-29T09:00:00-03:00' }),
  step({ position: 2, dose: 5, started_at: '2026-08-29T09:00:00-03:00', ended_at: '2026-09-26T09:00:00-03:00' }),
  step({ position: 3, dose: 7.5, status: 'current', started_at: '2026-09-26T09:00:00-03:00', duration_days: null }),
  step({ position: 4, dose: 10, status: 'upcoming', duration_days: null }),
]

function args(over: Partial<BuildProtocolMeasureSeriesArgs> = {}): BuildProtocolMeasureSeriesArgs {
  return {
    biomarkerType: 'peso',
    protocol: PROTO,
    medicines: [MOUN, MET],
    steps: LADDER,
    measures: [],
    doseDays: [],
    timezone: TZ,
    to: '2026-10-05',
    ...over,
  }
}

describe('buildProtocolMeasureSeries — elegibilidade e etapas', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('oral diário ⇒ null (R-11)', () => {
    const oral = { ...PROTO, id: 'p_met', medicine_id: 'm_met', frequency: 'diário' }
    expect(buildProtocolMeasureSeries(args({ protocol: oral, steps: [] }))).toBeNull()
  })

  it('oral semanal é elegível; cadastro ausente decide só pela frequência', () => {
    const weeklyOral = { ...PROTO, medicine_id: 'm_met' }
    expect(buildProtocolMeasureSeries(args({ protocol: weeklyOral }))).not.toBeNull()
    const noMed = { ...PROTO, medicine_id: 'm_none', frequency: 'diário' }
    expect(buildProtocolMeasureSeries(args({ protocol: noMed }))).toBeNull()
  })

  it('escada de 3 etapas + 1 prevista: 3 steps com média, n, taken/expected; current só na vigente (PO-17)', () => {
    const r = buildProtocolMeasureSeries(
      args({
        measures: [peso('2026-08-05', 90), peso('2026-08-20', 89), peso('2026-09-10', 88), peso('2026-09-30', 86.5)],
        doseDays: [
          doseDay('p_moun', '2026-08-08', 1),
          doseDay('p_moun', '2026-08-15', 0, 1),
          doseDay('p_moun', '2026-09-05', 1),
          doseDay('p_moun', '2026-09-12', 1),
          doseDay('p_moun', '2026-10-03', 1),
        ],
      })
    )
    expect(r?.series.steps.map((s) => [s.dose, s.start, s.end, s.meanKg, s.count, s.taken, s.expected, s.current])).toEqual([
      ['2,5 mg (≈ 0,25 mL)', '2026-08-01', '2026-08-29', 89.5, 2, 1, 2, false],
      ['5 mg (≈ 0,5 mL)', '2026-08-29', '2026-09-26', 88, 1, 2, 2, false],
      ['7,5 mg (≈ 0,75 mL)', '2026-09-26', null, 86.5, 1, 1, 1, true],
    ])
    expect(r?.state).toBe('B0')
  })

  it('etapa prevista não vira faixa e a janela começa na 1ª etapa iniciada', () => {
    const r = buildProtocolMeasureSeries(args({ measures: [peso('2026-07-20', 95), peso('2026-08-02', 90)] }))
    expect(r?.series.steps).toHaveLength(3)
    // pesagem antes da 1ª etapa fica fora
    expect(r?.series.points).toEqual([{ day: '2026-08-02', kg: 90 }])
  })

  it('sem escada ⇒ 1 etapa sintética desde start_date, vigente, com a dose do tratamento (AC-8b)', () => {
    const r = buildProtocolMeasureSeries(args({ steps: [], measures: [peso('2026-08-10', 90)] }))
    expect(r?.series.steps).toEqual([
      expect.objectContaining({ index: 1, dose: '5 mg (≈ 0,5 mL)', start: '2026-08-01', end: null, current: true, count: 1 }),
    ])
  })

  it('escada de 1 etapa ⇒ tratada como sem titulação (E-B6)', () => {
    const one = [step({ position: 1, dose: 2.5, status: 'current', started_at: '2026-08-20T09:00:00-03:00' })]
    const r = buildProtocolMeasureSeries(args({ steps: one }))
    expect(r?.series.steps).toEqual([expect.objectContaining({ dose: '5 mg (≈ 0,5 mL)', start: '2026-08-01', current: true })])
  })

  it('start_date futuro ⇒ sem etapa e B3 (E-B6)', () => {
    const r = buildProtocolMeasureSeries(args({ protocol: { ...PROTO, start_date: '2026-11-01' }, steps: [], measures: [peso('2026-10-01', 90)] }))
    expect(r?.series.steps).toEqual([])
    expect(r?.series.points).toEqual([])
    expect(r?.state).toBe('B3')
  })

  it('start_date nulo sem escada ⇒ série vazia, sem erro', () => {
    const r = buildProtocolMeasureSeries(args({ protocol: { ...PROTO, start_date: null }, steps: [] }))
    expect(r?.series.steps).toEqual([])
    expect(r?.state).toBe('B3')
  })

  it('escada só com etapas previstas ⇒ sem faixa', () => {
    const planned = LADDER.map((s) => ({ ...s, status: 'upcoming', started_at: null, ended_at: null }))
    expect(buildProtocolMeasureSeries(args({ steps: planned }))?.series.steps).toEqual([])
  })

  it('piso recorta a 1ª etapa (relatório)', () => {
    const r = buildProtocolMeasureSeries(args({ floor: '2026-09-01', measures: [peso('2026-08-20', 89), peso('2026-09-02', 88)] }))
    expect(r?.series.points).toEqual([{ day: '2026-09-02', kg: 88 }])
    expect(r?.series.steps[0]).toMatchObject({ start: '2026-09-01', clipped: true })
  })

  it('doses contam pelo protocol_id da linha do fato, nunca de outro tratamento (R-299, E-B1)', () => {
    const r = buildProtocolMeasureSeries(
      args({
        steps: [],
        doseDays: [doseDay('p_moun', '2026-08-08', 1), doseDay('p_outro', '2026-08-08', 3, 2), doseDay(null, '2026-08-09', 1)],
      })
    )
    expect(r?.series.steps[0]).toMatchObject({ taken: 1, expected: 1 })
  })

  it('várias linhas no mesmo dia somam (slots)', () => {
    const r = buildProtocolMeasureSeries(
      args({ steps: [], doseDays: [doseDay('p_moun', '2026-08-08', 1), doseDay('p_moun', '2026-08-08', 0, 1)] })
    )
    expect(r?.series.steps[0]).toMatchObject({ taken: 1, expected: 2 })
  })
})

describe('ladderStepDays — datas reais e previstas', () => {
  it('etapa futura encadeia a partir do fim previsto da anterior; duração inválida = sem fim', () => {
    const rows = [
      step({ position: 1, status: 'current', started_at: '2026-09-01T09:00:00-03:00' }),
      step({ position: 2, status: 'upcoming', duration_days: 14 }),
      step({ position: 3, status: 'upcoming', duration_days: 0 }),
      step({ position: 4, status: 'upcoming', dose: null }),
    ]
    const days = ladderStepDays(rows, PROTO, [MOUN], TZ)
    expect(days.map((d) => [d.start, d.end, d.planned, d.durationDays])).toEqual([
      ['2026-09-01', '2026-09-29', false, 28],
      ['2026-09-29', '2026-10-13', true, 14],
      ['2026-10-13', null, true, null],
      [null, null, true, 28],
    ])
    expect(days[3].doseLabel).toBe('-')
  })

  it('cada degrau carrega o próprio cadastro; sem cadastro, o do tratamento', () => {
    const other = { ...MOUN, id: 'm_moun15', dosage_per_pill: 15 }
    const days = ladderStepDays([step({ position: 1, medicine_id: 'm_moun15' }), step({ position: 2, medicine_id: null })], PROTO, [MOUN, other], TZ)
    expect(days.map((d) => d.medicine?.id)).toEqual(['m_moun15', 'm_moun'])
  })

  it('23h30 -03 do started_at fica no dia local (R-020)', () => {
    const [d] = ladderStepDays([step({ position: 1, started_at: '2026-09-01T23:30:00-03:00', ended_at: null })], PROTO, [MOUN], TZ)
    expect(d.start).toBe('2026-09-01')
  })
})

// 069 Bb (PO-8, analysis-Bb L-3/L-5): janela do leitor do card.
describe('protocolMeasureWindowStart', () => {
  it('escada: dia local da 1ª etapa iniciada (mesma regra da ponte)', () => {
    expect(protocolMeasureWindowStart({ protocol: PROTO, medicines: [MOUN], steps: LADDER, timezone: TZ })).toBe('2026-08-01')
  })
  it('sem escada ou 1 etapa: start_date do tratamento', () => {
    const p = { ...PROTO, start_date: '2026-09-10' }
    expect(protocolMeasureWindowStart({ protocol: p, medicines: [MOUN], steps: [], timezone: TZ })).toBe('2026-09-10')
    expect(protocolMeasureWindowStart({ protocol: p, medicines: [MOUN], steps: [LADDER[0]], timezone: TZ })).toBe('2026-09-10')
  })
  it('start_date nulo e sem escada: null', () => {
    expect(protocolMeasureWindowStart({ protocol: { ...PROTO, start_date: null }, medicines: [], steps: [], timezone: TZ })).toBeNull()
  })
  it('a ponte usa o mesmo início (from da série)', () => {
    const r = buildProtocolMeasureSeries(args({ measures: [peso('2026-07-30', 90), peso('2026-08-02', 89)] }))
    expect(r?.series.points.map((p) => p.day)).toEqual(['2026-08-02'])
  })
})

describe('splitDayWindow', () => {
  it('from > to: nenhuma fatia', () => {
    expect(splitDayWindow('2026-10-06', '2026-10-05')).toEqual([])
  })
  it('1 dia: 1 fatia', () => {
    expect(splitDayWindow('2026-10-05', '2026-10-05')).toEqual([{ from: '2026-10-05', to: '2026-10-05' }])
  })
  it('186 dias inclusivos cabem em 1 fatia; 187 viram 2', () => {
    expect(splitDayWindow('2026-01-01', '2026-07-05')).toHaveLength(1)
    expect(splitDayWindow('2026-01-01', '2026-07-06')).toHaveLength(2)
  })
  it('400 dias atravessando o ano: contíguas, sem buraco nem sobreposição, cada uma ≤ 186 dias', () => {
    const slices = splitDayWindow('2025-09-01', '2026-10-05')
    expect(slices[0].from).toBe('2025-09-01')
    expect(slices[slices.length - 1].to).toBe('2026-10-05')
    slices.forEach((s, i) => {
      expect(daysBetween(s.from, s.to)).toBeLessThanOrEqual(185)
      if (i > 0) expect(s.from).toBe(shiftDay(slices[i - 1].to, 1))
    })
  })
})
