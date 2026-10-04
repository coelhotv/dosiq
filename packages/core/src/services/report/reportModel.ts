/**
 * buildReportModel — monta o modelo completo do relatório clínico a partir das entradas do coletor
 * (spec 097 FR-001/FR-004, INV-1..INV-4). Puro: sem I/O, sem plataforma, sem relógio implícito —
 * `generatedAt` vem do chamador.
 *
 * Seções do presente (medicamentos, estoque, "para esta consulta") avaliam no último dia do período;
 * seções históricas (tomadas, encerrados, mudanças, escadas) derivam do fato registrado. Seção
 * opcional sem dado fica vazia/`null` no modelo — o template decide omitir (DESIGN_DECISOES §3).
 * Dose × biomarcador e locais de aplicação entram no Slice C.
 */
import { isInjectable } from '../../utils/injectionSites'
import {
  buildTreatmentMeasureSeries,
  pickMeasureSeriesState,
  type TreatmentMeasureSeries,
} from '../treatmentMeasureSeries'
import { daysBetween, localDayOf, medicineOf } from './reportFormat'
import type { ReportInputs, ReportWindow } from './reportTypes'
import { buildChanges, pausedRanges, type ChangeItem } from './reportSections/changes'
import { buildForThisVisit, buildHeader, type ReportHeader, type VisitItem } from './reportSections/header'
import { buildIntakesSection, type IntakesSection } from './reportSections/intakes'
import { buildLadders, type Ladder } from './reportSections/ladders'
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
  /** `null` = rastreio de estoque desligado (044): a seção não existe. */
  stock: StockRow[] | null
}

function _weightSeries(ladder: Ladder, inputs: ReportInputs): Pick<ReportLadder, 'weightSeries' | 'weightChart'> {
  const none = { weightSeries: null, weightChart: false }
  const protocol = inputs.protocols.find((p) => p.id === ladder.protocolId)
  if (!protocol) return none
  // Regra da 069 (Clarifications): semanal OU injetável.
  const eligible = isInjectable(medicineOf(protocol, inputs.medicines)) || protocol.frequency === 'semanal'
  if (!eligible) return none

  const firstStart = ladder.steps.find((s) => !s.planned && s.start)?.start ?? null
  const doseDays = new Map<string, { day: string; taken: number; missed: number }>()
  for (const r of inputs.doseDays) {
    if (r.protocol_id !== protocol.id) continue
    const d = doseDays.get(r.day) ?? { day: r.day, taken: 0, missed: 0 }
    d.taken += r.taken_count
    d.missed += r.missed_count
    doseDays.set(r.day, d)
  }

  const series = buildTreatmentMeasureSeries({
    biomarkerType: 'peso',
    measures: inputs.biomarkers,
    steps: ladder.steps.map((s) => ({ doseLabel: s.doseLabel, start: s.planned ? null : s.start, end: s.end, current: s.state === 'current' })),
    doseDays: [...doseDays.values()],
    timezone: inputs.timezone,
    // Como na 069: o gráfico começa na 1ª etapa (recortada ao período), não no início do período.
    from: firstStart && firstStart > inputs.window.from ? firstStart : inputs.window.from,
    to: inputs.window.to,
  })
  // Linhas por etapa com qualquer pesagem (fato); gráfico só no B-0, como no app (smoke 097 A2).
  if (series.points.length === 0) return none
  return { weightSeries: series, weightChart: pickMeasureSeriesState(series, inputs.window.to) === 'B0' }
}

/**
 * Trecho do período com registro: começa no primeiro dia com dose prevista (tomada, perdida ou
 * pausada) ou com medida. Antes disso não havia nada no app — dia vazio ali não é falta, é ausência
 * de registro, e não entra nas faixas nem nos denominadores (smoke 097 A2). Sem registro nenhum,
 * fica o período inteiro.
 */
export function dataWindowOf(inputs: ReportInputs): ReportWindow {
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
  if (first === null || first <= from) return inputs.window
  return { from: first, to, days: daysBetween(first, to) + 1 }
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

export function buildReportModel(original: ReportInputs, { generatedAt }: { generatedAt: string }): ReportModel {
  const inputs: ReportInputs = { ...original, window: dataWindowOf(original) }
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
    header: { ...buildHeader(inputs, intakes), window: original.window, dataWindow: inputs.window },
    forThisVisit: buildForThisVisit(medications, stock, ladders, asOf),
    medications,
    intakes,
    // Mudanças são fatos datados: valem no período PEDIDO, não só no trecho com registro (RC6 #857).
    changes: buildChanges({ ...inputs, window: original.window }, intakes, ladders),
    ladders,
    stock,
  }
}
