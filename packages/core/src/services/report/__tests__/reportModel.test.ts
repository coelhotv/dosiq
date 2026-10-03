// Montador do relatório clínico (spec 097 A1 — PO-1 por seção, PO-2).
// Fixture: janela de 7 dias (24–30/09/2026, America/Sao_Paulo). Datas locais literais; instantes
// com offset -03 explícito (AP-270). Inclui 1 tratamento arquivado e 1 pausado.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportModel } from '../reportModel'
import type {
  ReportDoseDayRow,
  ReportInputs,
  ReportMedicineRow,
  ReportProtocolRow,
  ReportTitrationStepRow,
} from '../reportTypes'

const med = (over: Partial<ReportMedicineRow> & { id: string; name: string }): ReportMedicineRow => ({
  active_ingredient: null,
  dosage_per_pill: null,
  dosage_unit: 'mg',
  units_per_ml: null,
  concentration_volume_ml: null,
  presentation: 'comprimido',
  type: 'medicamento',
  shelf_life_days: null,
  archived_at: null,
  ...over,
})

const proto = (over: Partial<ReportProtocolRow> & { id: string; medicine_id: string }): ReportProtocolRow => ({
  name: null,
  frequency: 'diário',
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  intake_unit: null,
  interval_days: null,
  weekdays: null,
  start_date: '2026-01-01',
  end_date: null,
  active: true,
  paused_at: null,
  archived_at: null,
  ...over,
})

const dd = (protocol_id: string, medicine_id: string, day: string, slot: string, c: Partial<ReportDoseDayRow>): ReportDoseDayRow => ({
  protocol_id,
  medicine_id,
  day,
  slot,
  taken_count: 0,
  missed_count: 0,
  paused_count: 0,
  skipped_count: 0,
  pending_count: 0,
  ...c,
})

const DAYS = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']

function fixture(over: Partial<ReportInputs> = {}): ReportInputs {
  const medicines = [
    med({ id: 'm_met', name: 'Glifage', active_ingredient: 'Metformina', dosage_per_pill: 850 }),
    med({ id: 'm_moun', name: 'Mounjaro', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 10, concentration_volume_ml: 0.5, shelf_life_days: 21 }),
    med({ id: 'm_lev', name: 'Puran', dosage_per_pill: 50, dosage_unit: 'mcg' }),
    med({ id: 'm_old', name: 'Losartana', dosage_per_pill: 50 }),
  ]
  const protocols = [
    proto({ id: 'p_met', medicine_id: 'm_met', time_schedule: ['08:00', '20:00'] }),
    proto({ id: 'p_moun', medicine_id: 'm_moun', frequency: 'semanal', time_schedule: ['09:00'], intake_unit: 'mg', dosage_per_intake: 5, start_date: '2026-08-01', end_date: '2026-10-05' }),
    // pausado hoje: active=false (pausar grava active=false — adherenceLogic.ts:360)
    proto({ id: 'p_lev', medicine_id: 'm_lev', time_schedule: ['07:00'], active: false, paused_at: '2026-09-27T10:00:00-03:00' }),
    // arquivado (094) no dia 27
    proto({ id: 'p_old', medicine_id: 'm_old', active: false, archived_at: '2026-09-27T15:00:00-03:00' }),
  ]
  const doseDays: ReportDoseDayRow[] = [
    ...DAYS.flatMap((d, i) => [
      dd('p_met', 'm_met', d, '08:00', { taken_count: 1 }),
      // noite: falta no dia 25 e no dia 29
      dd('p_met', 'm_met', d, '20:00', i === 1 || i === 5 ? { missed_count: 1 } : { taken_count: 1 }),
    ]),
    dd('p_moun', 'm_moun', '2026-09-25', '09:00', { taken_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-24', '07:00', { taken_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-25', '07:00', { taken_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-26', '07:00', { missed_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-27', '07:00', { paused_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-28', '07:00', { paused_count: 1 }),
    dd('p_lev', 'm_lev', '2026-09-29', '07:00', { skipped_count: 1 }),
    dd('p_old', 'm_old', '2026-09-24', '08:00', { taken_count: 1 }),
    dd('p_old', 'm_old', '2026-09-25', '08:00', { taken_count: 1 }),
    dd('p_old', 'm_old', '2026-09-26', '08:00', { taken_count: 1 }),
    // hoje ainda pendente: fora do denominador (ADR-054)
    dd('p_met', 'm_met', '2026-09-30', '22:00', { pending_count: 1 }),
  ]
  return {
    window: { from: '2026-09-24', to: '2026-09-30', days: 7 },
    timezone: 'America/Sao_Paulo',
    profile: { displayName: 'Ana', birthDate: '1960-05-02', allergies: ['Dipirona'], bloodType: null },
    stockTrackingEnabled: true,
    protocols,
    medicines,
    doseDays,
    titrationSteps: [],
    stockTotals: [
      { medicine_id: 'm_met', total_quantity: 20 },
      { medicine_id: 'm_moun', total_quantity: 20 },
    ],
    biomarkers: [
      { id: 'b1', type: 'glicemia', value: 110, value_secondary: null, unit: 'mg/dL', measured_at: '2026-09-26T23:30:00-03:00', context: 'jejum' },
    ],
    medicineLogs: [],
    ...over,
  }
}

const GEN = '2026-09-30T18:00:00-03:00'

describe('buildReportModel — seções do presente (INV-1)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('medicamentos em uso: vigentes no último dia, sem arquivado e sem pausado; injetáveis primeiro', () => {
    const m = buildReportModel(fixture(), { generatedAt: GEN })
    expect(m.medications.map((r) => r.protocolId)).toEqual(['p_moun', 'p_met'])
  })

  it('dose na unidade da tomada, dose total no ciclo, término e validade após aberto', () => {
    const [moun, met] = buildReportModel(fixture(), { generatedAt: GEN }).medications
    expect(moun.dosePerIntake).toMatch(/^5 mg/)
    expect(moun.cycleDose).toMatch(/semana/)
    expect(moun.endDate).toBe('2026-10-05')
    expect(moun.endStatus).toBe('vencendo')
    expect(moun.injectable).toBe(true)
    expect(moun.shelfLifeDays).toBe(21)
    expect(met.endDate).toBeNull()
    expect(met.endStatus).toBeNull()
    expect(met.times).toEqual(['08:00', '20:00'])
    expect(met.detail).toContain('Metformina')
    expect(`${moun.dosePerIntake} ${met.dosePerIntake}`).not.toMatch(/comprimido.*mg\/ml|un\.\s*$/)
  })

  it('"para esta consulta": receita vencendo com a data concreta', () => {
    const m = buildReportModel(fixture(), { generatedAt: GEN })
    expect(m.forThisVisit).toContainEqual({ kind: 'receita', name: 'Mounjaro', day: '2026-10-05', status: 'vencendo', doseLabel: null })
  })

  it('estoque com rastreio: "dura até" em asOf, sem nenhum campo de custo', () => {
    const m = buildReportModel(fixture(), { generatedAt: GEN })
    const met = m.stock?.find((s) => s.medicineId === 'm_met')
    expect(met).toMatchObject({ quantity: 20, dailyIntake: 2, daysRemaining: 10, runsOutOn: '2026-10-10', soon: true })
    expect(JSON.stringify(m)).not.toMatch(/price|preço|custo|R\$/i)
    expect(m.forThisVisit).toContainEqual({ kind: 'estoque', name: 'Glifage', day: '2026-10-10', status: null, doseLabel: null })
  })

  it('dose-only (stockTrackingEnabled=false): sem seção nem item de estoque (PO-2a, FR-007)', () => {
    const m = buildReportModel(fixture({ stockTrackingEnabled: false }), { generatedAt: GEN })
    expect(m.stock).toBeNull()
    expect(m.forThisVisit.some((i) => i.kind === 'estoque')).toBe(false)
  })
})

describe('buildReportModel — seções históricas pelo fato (PO-2b, R-299)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('tratamento pausado conta nos dias vigentes; pausa aparece como pausa, não como perdida', () => {
    const lev = buildReportModel(fixture(), { generatedAt: GEN }).intakes.active.find((r) => r.protocolId === 'p_lev')
    expect(lev).toBeDefined()
    expect(lev?.taken).toBe(2)
    expect(lev?.expected).toBe(3) // pausa e pulo fora do denominador
    expect(lev?.days.map((d) => d.state)).toEqual(['full', 'full', 'none', 'paused', 'paused', 'empty', 'empty'])
  })

  it('arquivado no período vai para "encerrados" com o dia e conta os dias em que existiu', () => {
    const m = buildReportModel(fixture(), { generatedAt: GEN })
    expect(m.intakes.active.some((r) => r.protocolId === 'p_old')).toBe(false)
    const old = m.intakes.ended.find((r) => r.protocolId === 'p_old')
    expect(old).toMatchObject({ endedOn: '2026-09-27', taken: 3, expected: 3, percent: 100 })
    expect(old?.days.slice(3).every((d) => d.state === 'empty')).toBe(true)
  })

  it('contagem por horário e faixa diária categórica; pendente de hoje fora do denominador', () => {
    const met = buildReportModel(fixture(), { generatedAt: GEN }).intakes.active.find((r) => r.protocolId === 'p_met')
    expect(met).toMatchObject({ taken: 12, expected: 14, percent: 86 })
    expect(met?.bySlot).toEqual([
      { slot: '08:00', taken: 7, expected: 7 },
      { slot: '20:00', taken: 5, expected: 7 },
    ])
    expect(met?.days.map((d) => d.state)).toEqual(['full', 'partial', 'full', 'full', 'full', 'partial', 'full'])
  })

  it('denominador zero ⇒ percentual null, nunca 0%', () => {
    const inputs = fixture({
      doseDays: [dd('p_met', 'm_met', '2026-09-27', '08:00', { paused_count: 1 })],
    })
    const met = buildReportModel(inputs, { generatedAt: GEN }).intakes.active.find((r) => r.protocolId === 'p_met')
    expect(met).toMatchObject({ taken: 0, expected: 0, percent: null })
  })

  it('mudanças datadas: pausa (faixa) e exclusão', () => {
    const { changes } = buildReportModel(fixture(), { generatedAt: GEN })
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'paused', protocolId: 'p_lev', day: '2026-09-27', until: '2026-09-28' }))
    expect(changes).toContainEqual(expect.objectContaining({ kind: 'archived', protocolId: 'p_old', day: '2026-09-27' }))
  })

  it('cabeçalho: dias com dose e com medida (medida de 23h30 no próprio dia local)', () => {
    const { header } = buildReportModel(fixture(), { generatedAt: GEN })
    expect(header.daysWithDose).toEqual({ count: 7, of: 7 })
    expect(header.daysWithMeasure).toEqual({ count: 1, of: 7 })
    expect(header.allergies).toEqual(['Dipirona'])
    expect(header.bloodType).toBeNull()
  })

  it('sem nenhum registro: seções históricas vazias, sem erro', () => {
    const m = buildReportModel(fixture({ doseDays: [], biomarkers: [] }), { generatedAt: GEN })
    expect(m.intakes).toEqual({ active: [], ended: [] })
    expect(m.header.daysWithDose).toEqual({ count: 0, of: 7 })
  })
})

describe('buildReportModel — escada de titulação (DS-5, AP-311) e peso por etapa (DS-7)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  const step = (over: Partial<ReportTitrationStepRow> & { id: string; position: number }): ReportTitrationStepRow => ({
    titration_id: 't1',
    medicine_id: 'm_moun',
    protocol_id: null,
    dose: 2.5,
    intake_unit: 'mg',
    duration_days: 28,
    status: 'completed',
    started_at: null,
    ended_at: null,
    ...over,
  })

  // Etapa 1 antes do período (sem protocol_id — recorte que o embed perderia), 2 atual, 3 prevista.
  const steps = [
    step({ id: 's1', position: 1, dose: 2.5, started_at: '2026-08-01T09:00:00-03:00', ended_at: '2026-08-29T09:00:00-03:00' }),
    step({ id: 's2', position: 2, dose: 5, status: 'current', protocol_id: 'p_moun', started_at: '2026-08-29T09:00:00-03:00' }),
    step({ id: 's3', position: 3, dose: 7.5, status: 'upcoming', duration_days: null }),
  ]

  it('escada completa por titulação, com datas reais e previstas encadeadas', () => {
    const m = buildReportModel(fixture({ titrationSteps: steps }), { generatedAt: GEN })
    expect(m.ladders).toHaveLength(1)
    const [ladder] = m.ladders
    expect(ladder.protocolId).toBe('p_moun')
    expect(ladder.steps.map((s) => [s.state, s.start, s.end, s.planned])).toEqual([
      ['completed', '2026-08-01', '2026-08-29', false],
      ['current', '2026-08-29', '2026-09-26', false],
      ['planned', '2026-09-26', null, true],
    ])
    expect(m.medications.find((r) => r.protocolId === 'p_moun')?.titrationChip).toBe('Titulação 2/3')
  })

  it('sem escada registrada: nenhum bloco e nenhum chip', () => {
    const m = buildReportModel(fixture(), { generatedAt: GEN })
    expect(m.ladders).toEqual([])
    expect(m.medications.every((r) => r.titrationChip === null)).toBe(true)
  })

  it('peso por etapa só no B-0 (≥3 pesagens e ≥14 dias); abaixo disso, sem gráfico', () => {
    const peso = (day: string, kg: number) => ({ id: day, type: 'peso', value: kg, value_secondary: null, unit: 'kg', measured_at: `${day}T07:00:00-03:00`, context: null })
    const window = { from: '2026-09-01', to: '2026-09-30', days: 30 }
    const ok = buildReportModel(
      fixture({ window, titrationSteps: steps, biomarkers: [peso('2026-09-02', 90), peso('2026-09-09', 89), peso('2026-09-16', 88)] }),
      { generatedAt: GEN }
    )
    expect(ok.ladders[0].weightSeries?.points).toHaveLength(3)
    expect(ok.ladders[0].weightSeries?.steps[0]).toMatchObject({ start: '2026-09-01', clipped: true })

    const few = buildReportModel(
      fixture({ window, titrationSteps: steps, biomarkers: [peso('2026-09-02', 90), peso('2026-09-09', 89)] }),
      { generatedAt: GEN }
    )
    expect(few.ladders[0].weightSeries).toBeNull()
  })

  it('tratamento oral diário com escada: nunca gráfico de peso', () => {
    const oral = steps.map((s) => ({ ...s, medicine_id: 'm_met', protocol_id: s.protocol_id ? 'p_met' : null }))
    const peso = (day: string) => ({ id: day, type: 'peso', value: 80, value_secondary: null, unit: 'kg', measured_at: `${day}T07:00:00-03:00`, context: null })
    const m = buildReportModel(
      fixture({ window: { from: '2026-09-01', to: '2026-09-30', days: 30 }, titrationSteps: oral, biomarkers: [peso('2026-09-02'), peso('2026-09-10'), peso('2026-09-20')] }),
      { generatedAt: GEN }
    )
    expect(m.ladders[0].weightSeries).toBeNull()
  })
})
