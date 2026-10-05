// Caracterização do peso por etapa no relatório (069 Ba, RC3 E-B2). Congela o que a extração da
// ponte escada→série (protocolMeasureSeries) NÃO pode mudar: etapas da escada, série completa,
// gráfico, "fora das etapas" e o HTML renderizado. Nasceu VERDE contra o código anterior à extração.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderReportHtml } from '../reportTemplate'
import { buildReportModel } from '../reportModel'
import type { ReportBiomarkerRow, ReportTitrationStepRow } from '../reportTypes'
import { dd, fixture, GEN, med } from './reportFixture'

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

const peso = (at: string, kg: number): ReportBiomarkerRow => ({
  id: at,
  type: 'peso',
  value: kg,
  value_secondary: null,
  unit: 'kg',
  measured_at: at,
  context: null,
})

function scenario() {
  const base = fixture()
  // 1 antes do período (recortada), 2 encerrada com intervalo até a 3, 3 vigente em outro cadastro
  // (troca de caneta), 4 prevista.
  const titrationSteps = [
    step({ id: 's1', position: 1, dose: 2.5, started_at: '2026-08-01T09:00:00-03:00', ended_at: '2026-08-22T09:00:00-03:00' }),
    step({ id: 's2', position: 2, dose: 5, protocol_id: 'p_moun', started_at: '2026-08-22T09:00:00-03:00', ended_at: '2026-09-10T09:00:00-03:00' }),
    step({ id: 's3', position: 3, dose: 7.5, medicine_id: 'm_moun15', status: 'current', protocol_id: 'p_moun', started_at: '2026-09-12T09:00:00-03:00', duration_days: null }),
    step({ id: 's4', position: 4, dose: 10, status: 'upcoming', duration_days: null }),
  ]
  const moun = (day: string, c: { taken_count?: number; missed_count?: number }) => dd('p_moun', 'm_moun', day, '09:00', c)
  const doseDays = [
    ...base.doseDays.filter((r) => r.protocol_id !== 'p_moun'),
    moun('2026-08-08', { taken_count: 1 }), // antes do período: fora
    moun('2026-08-18', { taken_count: 1 }),
    moun('2026-08-25', { missed_count: 1 }),
    moun('2026-09-01', { taken_count: 1 }),
    moun('2026-09-08', { taken_count: 1 }),
    moun('2026-09-11', { taken_count: 1 }), // no intervalo entre etapas 2 e 3
    moun('2026-09-15', { taken_count: 1 }),
    moun('2026-09-22', { missed_count: 1 }),
    moun('2026-09-29', { taken_count: 1 }),
  ]
  const biomarkers = [
    ...base.biomarkers,
    peso('2026-08-10T07:00:00-03:00', 92), // antes do período
    peso('2026-08-16T07:00:00-03:00', 90),
    peso('2026-08-20T07:00:00-03:00', 89.5),
    peso('2026-08-20T21:00:00-03:00', 89), // mesmo dia: vale a mais recente
    peso('2026-09-02T07:00:00-03:00', 88.2),
    peso('2026-09-20T23:30:00-03:00', 87.4), // 23h30 -03 fica no dia 20 local
  ]
  return fixture({
    window: { from: '2026-08-15', to: '2026-09-30', days: 47 },
    medicines: [
      ...base.medicines,
      med({ id: 'm_moun15', name: 'Mounjaro', presentation: 'injetavel', dosage_unit: 'mg/ml', dosage_per_pill: 15, concentration_volume_ml: 0.5 }),
    ],
    titrationSteps,
    doseDays,
    biomarkers,
  })
}

describe('buildReportModel — caracterização do peso por etapa (069 Ba, E-B2)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('congela escada, série, gráfico e fora-das-etapas', () => {
    const m = buildReportModel(scenario(), { generatedAt: GEN })
    const ladder = m.ladders.find((l) => l.protocolId === 'p_moun')
    expect(ladder).toBeDefined()
    expect({
      steps: ladder?.steps,
      weightSeries: ladder?.weightSeries,
      weightChart: ladder?.weightChart,
      outsideSteps: ladder?.outsideSteps,
    }).toMatchSnapshot()
  })

  it('congela o HTML do relatório', () => {
    expect(renderReportHtml(buildReportModel(scenario(), { generatedAt: GEN }))).toMatchSnapshot()
  })
})
