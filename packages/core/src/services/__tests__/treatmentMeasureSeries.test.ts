// treatmentMeasureSeries (contrato 069 FR-009/FR-010; 097 PO-15).
// Datas de fixture são instantes com offset -03 explícito e dias locais literais (AP-270).
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTreatmentMeasureSeries,
  pickMeasureSeriesState,
  type MeasureInput,
  type MeasureStepInput,
} from '../treatmentMeasureSeries'

const TZ = 'America/Sao_Paulo'
const peso = (day: string, value: number, time = '08:00'): MeasureInput => ({
  type: 'peso',
  value,
  measured_at: `${day}T${time}:00-03:00`,
})
const ONE_STEP: MeasureStepInput[] = [{ doseLabel: '2,5 mg', start: '2026-01-01', end: null, current: true }]

function build(measures: MeasureInput[], over: Partial<Parameters<typeof buildTreatmentMeasureSeries>[0]> = {}) {
  return buildTreatmentMeasureSeries({
    biomarkerType: 'peso',
    measures,
    steps: ONE_STEP,
    doseDays: [],
    timezone: TZ,
    from: '2026-01-01',
    to: '2026-12-31',
    ...over,
  })
}

describe('pickMeasureSeriesState — casos da 069 PO-7', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('0 pesagens → B3', () => {
    expect(pickMeasureSeriesState(build([]), '2026-03-01')).toBe('B3')
  })
  it('1 pesagem há 3 dias → B3', () => {
    expect(pickMeasureSeriesState(build([peso('2026-02-26', 80)]), '2026-03-01')).toBe('B3')
  })
  it('2 pesagens, 1ª há 20 dias → B1', () => {
    expect(pickMeasureSeriesState(build([peso('2026-02-09', 80), peso('2026-02-20', 79)]), '2026-03-01')).toBe('B1')
  })
  it('2 pesagens em 5 dias → B3', () => {
    expect(pickMeasureSeriesState(build([peso('2026-02-24', 80), peso('2026-02-28', 79)]), '2026-03-01')).toBe('B3')
  })
  it('3 pesagens em 5 dias → B2', () => {
    const s = build([peso('2026-02-24', 80), peso('2026-02-26', 79), peso('2026-02-28', 79)])
    expect(pickMeasureSeriesState(s, '2026-03-01')).toBe('B2')
  })
  it('3 pesagens em 14 dias → B0', () => {
    const s = build([peso('2026-02-01', 80), peso('2026-02-08', 79), peso('2026-02-15', 78)])
    expect(pickMeasureSeriesState(s, '2026-03-01')).toBe('B0')
  })
  it('2 pesagens no mesmo dia contam como 1 (vale a mais recente)', () => {
    const s = build([peso('2026-02-01', 80, '07:00'), peso('2026-02-01', 81, '20:00'), peso('2026-02-15', 78)])
    expect(s.points).toEqual([
      { day: '2026-02-01', kg: 81 },
      { day: '2026-02-15', kg: 78 },
    ])
    expect(pickMeasureSeriesState(s, '2026-03-01')).toBe('B1')
  })
})

describe('buildTreatmentMeasureSeries', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('dia local: 23h30 em -03 fica no próprio dia (não no seguinte em UTC)', () => {
    const s = build([peso('2026-02-10', 80, '23:30')])
    expect(s.points).toEqual([{ day: '2026-02-10', kg: 80 }])
  })

  it('ignora outro tipo e valor não numérico', () => {
    const s = build([
      { type: 'glicemia', value: 110, measured_at: '2026-02-10T08:00:00-03:00' },
      { type: 'peso', value: Number.NaN, measured_at: '2026-02-11T08:00:00-03:00' },
      peso('2026-02-12', 80),
    ])
    expect(s.points).toEqual([{ day: '2026-02-12', kg: 80 }])
  })

  it('peso médio, n e doses por etapa; etapa anterior à janela cortada no início', () => {
    const steps: MeasureStepInput[] = [
      { doseLabel: '2,5 mg', start: '2026-08-20', end: '2026-09-17', current: false },
      { doseLabel: '5 mg', start: '2026-09-17', end: null, current: true },
      { doseLabel: '7,5 mg', start: null, end: null, current: false }, // prevista: fora
    ]
    const s = build(
      [peso('2026-09-03', 90), peso('2026-09-10', 89), peso('2026-09-17', 88), peso('2026-09-24', 87.5)],
      {
        steps,
        from: '2026-09-01',
        to: '2026-09-30',
        doseDays: [
          { day: '2026-08-27', taken: 1, missed: 0 }, // antes da janela: fora
          { day: '2026-09-03', taken: 1, missed: 0 },
          { day: '2026-09-10', taken: 0, missed: 1 },
          { day: '2026-09-17', taken: 1, missed: 0 },
          { day: '2026-09-24', taken: 1, missed: 0 },
        ],
      }
    )
    expect(s.steps).toEqual([
      { index: 1, dose: '2,5 mg', start: '2026-09-01', end: '2026-09-17', clipped: true, meanKg: 89.5, count: 2, taken: 1, expected: 2, current: false },
      { index: 2, dose: '5 mg', start: '2026-09-17', end: null, clipped: false, meanKg: 87.8, count: 2, taken: 2, expected: 2, current: true },
    ])
    expect(s.firstDay).toBe('2026-09-03')
    expect(s.lastDay).toBe('2026-09-24')
    expect(pickMeasureSeriesState(s, '2026-09-30')).toBe('B0')
  })

  it('etapa sem pesagem tem meanKg null (nunca 0); etapa encerrada antes da janela não entra', () => {
    const s = build([], {
      steps: [
        { doseLabel: 'a', start: '2026-06-01', end: '2026-08-01', current: false },
        { doseLabel: 'b', start: '2026-08-01', end: null, current: true },
      ],
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(s.steps).toHaveLength(1)
    expect(s.steps[0]).toMatchObject({ dose: 'b', meanKg: null, count: 0, expected: 0 })
  })

  it('medida fora da janela não entra', () => {
    const s = build([peso('2026-08-31', 90, '23:59'), peso('2026-10-01', 85, '00:01')], { from: '2026-09-01', to: '2026-09-30' })
    expect(s.points).toEqual([])
  })
})
