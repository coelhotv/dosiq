/**
 * buildReportModel — monta o modelo completo do relatório clínico a partir das entradas do coletor
 * (spec 097 FR-001/FR-004, INV-1..INV-4). Puro: sem I/O, sem plataforma, sem relógio implícito —
 * `generatedAt` vem do chamador.
 *
 * Seções do presente (medicamentos, estoque, "para esta consulta") avaliam no último dia do período;
 * seções históricas (tomadas, encerrados, mudanças, escadas) derivam do fato registrado. Seção
 * opcional sem dado fica vazia/`null` no modelo — o template decide omitir (DESIGN_DECISOES §3).
 * Medidas (com o cruzamento dose × medida) e locais de aplicação: Slice C.
 */
import { buildProtocolMeasureSeries } from '../protocolMeasureSeries'
import type { TreatmentMeasureSeries } from '../treatmentMeasureSeries'
import { localDayOf } from './reportFormat'
import type { ReportInputs, ReportWindow } from './reportTypes'
import { buildChanges, pausedRanges, type ChangeItem } from './reportSections/changes'
import { buildForThisVisit, buildHeader, type ReportHeader, type VisitItem } from './reportSections/header'
import { buildInjectionSites, type InjectionSiteCard } from './reportSections/injectionSites'
import { buildIntakesSection, type IntakesSection } from './reportSections/intakes'
import { buildLadders, type Ladder } from './reportSections/ladders'
import { buildMeasuresSection, type MeasuresSection } from './reportSections/measures'
import { buildMedicationRows, type MedicationRow } from './reportSections/medications'
import { buildStockRows, type StockRow } from './reportSections/stock'

export interface ReportMedicationRow extends MedicationRow {
  /** Última pausa dentro do período (faixa de dias locais), ou `null`. */
  pause: { from: string; to: string } | null
}

export interface ReportLadder extends Ladder {
  /** Peso por etapa (DS-7), para semanal ou injetável com ao menos uma pesagem na escada. */
  weightSeries: TreatmentMeasureSeries | null
  /** Gráfico só no estado B-0 da 069 (≥3 pesagens, ≥14 dias); abaixo disso, só as linhas por etapa. */
  weightChart: boolean
  /**
   * Doses do tratamento no período que não caem em nenhuma etapa registrada (escada com intervalo
   * entre etapas, ou doses antes da 1ª). `null` quando tudo cai em alguma etapa (smoke 097 A2).
   */
  outsideSteps: { taken: number; expected: number } | null
}

export interface ReportModel {
  generatedAt: string
  /** Fuso do dono (`user_settings.timezone`) — hora da geração no cabeçalho. */
  timezone: string
  header: ReportHeader
  forThisVisit: VisitItem[]
  medications: ReportMedicationRow[]
  intakes: IntakesSection
  changes: ChangeItem[]
  ladders: ReportLadder[]
  /** §3.7 — `null` sem medida no período: a seção não existe (PO-8). */
  measures: MeasuresSection | null
  /** §3.8 — vazio sem injetável no período: a seção não existe. */
  injectionSites: InjectionSiteCard[]
  /** `null` = rastreio de estoque desligado (044): a seção não existe. */
  stock: StockRow[] | null
}

function _weightSeries(ladder: Ladder, inputs: ReportInputs): Pick<ReportLadder, 'weightSeries' | 'weightChart'> {
  const none = { weightSeries: null, weightChart: false }
  const protocol = inputs.protocols.find((p) => p.id === ladder.protocolId)
  if (!protocol) return none
  // Ponte única com o card da 069-B: elegibilidade, etapas, janela e doses do próprio tratamento.
  const result = buildProtocolMeasureSeries({
    biomarkerType: 'peso',
    protocol,
    medicines: inputs.medicines,
    steps: inputs.titrationSteps.filter((s) => s.titration_id === ladder.titrationId),
    measures: inputs.biomarkers,
    doseDays: inputs.doseDays,
    timezone: inputs.timezone,
    // Como na 069: o gráfico começa na 1ª etapa, recortada ao período.
    floor: inputs.window.from,
    to: inputs.window.to,
  })
  // Linhas por etapa com qualquer pesagem (fato); gráfico só no B-0, como no app (smoke 097 A2).
  if (!result || result.series.points.length === 0) return none
  return { weightSeries: result.series, weightChart: result.state === 'B0' }
}

/**
 * Primeiro dia do período com dose prevista (tomada, perdida ou pausada) ou com medida, se for
 * depois do 1º dia do período; senão `null`. Só alimenta o aviso "registros a partir de …" do
 * cabeçalho — o eixo das faixas e os denominadores são sempre o período inteiro (smoke 097 B).
 */
export function firstRecordDayOf(inputs: ReportInputs): string | null {
  const { from, to } = inputs.window
  let first: string | null = null
  for (const r of inputs.doseDays) {
    if (r.day < from || r.day > to) continue
    if (r.taken_count + r.missed_count + r.paused_count === 0) continue
    if (first === null || r.day < first) first = r.day
  }
  for (const b of inputs.biomarkers) {
    const day = localDayOf(b.measured_at, inputs.timezone)
    if (!day || day < from || day > to) continue
    if (first === null || day < first) first = day
  }
  return first !== null && first > from ? first : null
}

function _outsideSteps(
  protocolId: string,
  series: TreatmentMeasureSeries | null,
  intakes: IntakesSection
): ReportLadder['outsideSteps'] {
  if (!series) return null
  const row = [...intakes.active, ...intakes.ended].find((r) => r.protocolId === protocolId)
  if (!row) return null
  const taken = row.taken - series.steps.reduce((n, s) => n + s.taken, 0)
  const expected = row.expected - series.steps.reduce((n, s) => n + s.expected, 0)
  return expected > 0 ? { taken: Math.max(0, taken), expected } : null
}

export function buildReportModel(inputs: ReportInputs, { generatedAt }: { generatedAt: string }): ReportModel {
  const asOf = inputs.window.to
  const intakes = buildIntakesSection(inputs)
  const allLadders = buildLadders(inputs)
  const medicationsBase = buildMedicationRows(inputs, allLadders)

  // Escada aparece para tratamento em uso ou com dose no período (o encerrado também — §3.5b).
  const relevant = new Set([
    ...medicationsBase.map((m) => m.protocolId),
    ...intakes.active.map((r) => r.protocolId),
    ...intakes.ended.map((r) => r.protocolId),
  ])
  const ladders: ReportLadder[] = allLadders
    .filter((l) => relevant.has(l.protocolId))
    .map((l) => {
      const weight = _weightSeries(l, inputs)
      return { ...l, ...weight, outsideSteps: _outsideSteps(l.protocolId, weight.weightSeries, intakes) }
    })

  const intakeById = new Map(intakes.active.map((r) => [r.protocolId, r]))
  const medications: ReportMedicationRow[] = medicationsBase.map((m) => {
    const ranges = pausedRanges(intakeById.get(m.protocolId)?.days ?? [])
    return { ...m, pause: ranges[ranges.length - 1] ?? null }
  })

  const stock = buildStockRows(inputs)
  return {
    generatedAt,
    timezone: inputs.timezone,
    header: { ...buildHeader(inputs, intakes), recordsFrom: firstRecordDayOf(inputs) },
    forThisVisit: buildForThisVisit(medications, stock, ladders, asOf),
    medications,
    intakes,
    changes: buildChanges(inputs, intakes, ladders),
    ladders,
    measures: buildMeasuresSection(inputs),
    injectionSites: buildInjectionSites(inputs),
    stock,
  }
}
