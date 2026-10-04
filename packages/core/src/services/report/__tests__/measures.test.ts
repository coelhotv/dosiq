// §3.7 Medidas + cruzamento dose × medida (spec 097 Slice C — PO-7, PO-8; FR-011/FR-012).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportModel } from '../reportModel'
import { buildMeasuresSection, measureStat } from '../reportSections/measures'
import type { ReportBiomarkerRow } from '../reportTypes'
import { dd, fixture, GEN } from './reportFixture'

const bio = (over: Partial<ReportBiomarkerRow> & { id: string; measured_at: string }): ReportBiomarkerRow => ({
  type: 'glicemia',
  value: 100,
  value_secondary: null,
  unit: 'mg/dL',
  context: null,
  ...over,
})

describe('measureStat', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('vazio → null; ímpar → central; par → média dos dois centrais', () => {
    expect(measureStat([])).toBeNull()
    expect(measureStat([130, 90, 110])).toEqual({ n: 3, min: 90, median: 110, max: 130 })
    expect(measureStat([100, 90, 120, 110])).toEqual({ n: 4, min: 90, median: 105, max: 120 })
  })
})

describe('buildMeasuresSection', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('sem medidas → null (seção ausente, PO-8)', () => {
    expect(buildMeasuresSection(fixture({ biomarkers: [] }))).toBeNull()
  })

  it('só tipo desconhecido (sem CHECK no banco) ou valor não finito → null', () => {
    const biomarkers = [
      bio({ id: 'x', type: 'batimentos', measured_at: '2026-09-25T08:00:00-03:00' }),
      bio({ id: 'y', value: Number.NaN, measured_at: '2026-09-25T08:00:00-03:00' }),
    ]
    expect(buildMeasuresSection(fixture({ biomarkers }))).toBeNull()
  })

  it('23h30 em -03 fica no dia local e na Noite; fora da janela é descartada', () => {
    const s = buildMeasuresSection(
      fixture({
        biomarkers: [
          bio({ id: 'a', measured_at: '2026-09-26T23:30:00-03:00', context: 'ao_deitar' }),
          bio({ id: 'b', measured_at: '2026-09-23T10:00:00-03:00' }),
        ],
      })
    )
    const gly = s?.blocks[0]
    expect(gly?.points).toHaveLength(1)
    expect(gly?.points[0]).toMatchObject({ day: '2026-09-26', time: '23:30', period: 'Noite' })
  })

  it('ordem fixa glicemia → pressão → peso; gráfico só com ≥ 3 glicemias', () => {
    const two = buildMeasuresSection(
      fixture({
        biomarkers: [
          bio({ id: 'p', type: 'peso', value: 82.4, unit: 'kg', measured_at: '2026-09-25T07:00:00-03:00' }),
          bio({ id: 'g1', measured_at: '2026-09-25T07:00:00-03:00' }),
          bio({ id: 'pa', type: 'pressao_arterial', value: 120, value_secondary: 80, unit: 'mmHg', measured_at: '2026-09-25T07:00:00-03:00' }),
          bio({ id: 'g2', measured_at: '2026-09-26T07:00:00-03:00' }),
        ],
      })
    )
    expect(two?.blocks.map((b) => b.type)).toEqual(['glicemia', 'pressao_arterial', 'peso'])
    expect(two?.blocks[0].chart).toBe(false)

    const three = buildMeasuresSection(
      fixture({
        biomarkers: ['24', '25', '26'].map((d, i) => bio({ id: `g${i}`, measured_at: `2026-09-${d}T07:00:00-03:00` })),
      })
    )
    expect(three?.blocks[0].chart).toBe(true)
  })

  it('agrupa por momento; contexto vazio ou desconhecido vira "sem momento" no fim', () => {
    const s = buildMeasuresSection(
      fixture({
        biomarkers: [
          bio({ id: 'a', value: 90, context: 'jejum', measured_at: '2026-09-24T07:00:00-03:00' }),
          bio({ id: 'b', value: 110, context: 'jejum', measured_at: '2026-09-25T07:00:00-03:00' }),
          bio({ id: 'c', value: 150, context: 'xpto', measured_at: '2026-09-25T13:00:00-03:00' }),
          bio({ id: 'd', value: 140, context: null, measured_at: '2026-09-26T13:00:00-03:00' }),
        ],
      })
    )
    const groups = s?.blocks[0].byContext
    expect(groups?.map((g) => g.label)).toEqual(['Jejum', 'sem momento'])
    expect(groups?.[0].stat).toEqual({ n: 2, min: 90, median: 100, max: 110 })
    expect(groups?.[1].stat.n).toBe(2)
  })

  it('pressão sem diastólica não quebra: estatística secundária só com o que existe', () => {
    const s = buildMeasuresSection(
      fixture({
        biomarkers: [
          bio({ id: 'a', type: 'pressao_arterial', value: 120, value_secondary: 80, measured_at: '2026-09-24T07:00:00-03:00' }),
          bio({ id: 'b', type: 'pressao_arterial', value: 130, value_secondary: null, measured_at: '2026-09-25T07:00:00-03:00' }),
        ],
      })
    )
    const g = s?.blocks[0].byContext[0]
    expect(g?.stat.n).toBe(2)
    expect(g?.secondary).toEqual({ n: 1, min: 80, median: 80, max: 80 })
  })

  it('cruzamento: doses tomadas do período do dia pelo slot local × medidas pela hora local; peso fora', () => {
    // Fixture: Glifage 08:00 tomada 7× e 20:00 tomada 5×; Mounjaro 09:00 1×; Puran 07:00 2×; Losartana 08:00 3×.
    const s = buildMeasuresSection(
      fixture({
        biomarkers: [
          bio({ id: 'a', value: 95, context: 'jejum', measured_at: '2026-09-24T06:30:00-03:00' }),
          bio({ id: 'b', value: 105, context: 'jejum', measured_at: '2026-09-25T07:10:00-03:00' }),
          bio({ id: 'c', value: 160, context: 'ao_deitar', measured_at: '2026-09-25T22:40:00-03:00' }),
          bio({ id: 'p', type: 'peso', value: 80, measured_at: '2026-09-25T15:00:00-03:00' }),
        ],
      })
    )
    expect(s?.cross).toEqual([
      {
        period: 'Manhã',
        dosesTaken: 7 + 1 + 2 + 3,
        measures: [{ type: 'glicemia', label: 'Glicemia', unit: 'mg/dL', stat: { n: 2, min: 95, median: 100, max: 105 }, secondary: null }],
      },
      {
        period: 'Noite',
        dosesTaken: 5,
        measures: [{ type: 'glicemia', label: 'Glicemia', unit: 'mg/dL', stat: { n: 1, min: 160, median: 160, max: 160 }, secondary: null }],
      },
    ])
  })

  it('período com medida e nenhuma dose tomada entra com 0 doses; doses fora da janela não contam', () => {
    const s = buildMeasuresSection(
      fixture({
        doseDays: [dd('p_met', 'm_met', '2026-09-20', '03:00', { taken_count: 4 })],
        biomarkers: [bio({ id: 'a', measured_at: '2026-09-25T03:00:00-03:00' })],
      })
    )
    expect(s?.cross).toEqual([expect.objectContaining({ period: 'Madrugada', dosesTaken: 0 })])
  })

  it('só peso → sem cruzamento', () => {
    const s = buildMeasuresSection(
      fixture({ biomarkers: [bio({ id: 'p', type: 'peso', value: 80, measured_at: '2026-09-25T07:00:00-03:00' })] })
    )
    expect(s?.blocks).toHaveLength(1)
    expect(s?.cross).toEqual([])
  })

  it('PO-8: sem medidas, as demais seções do modelo são idênticas', () => {
    const without = buildReportModel(fixture({ biomarkers: [] }), { generatedAt: GEN })
    expect(without.measures).toBeNull()
    const { measures: _m, header: _h, ...rest } = without
    const withB = buildReportModel(fixture(), { generatedAt: GEN })
    const { measures: _m2, header: _h2, ...rest2 } = withB
    expect(rest).toEqual(rest2)
  })
})
