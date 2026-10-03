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
import { medicineOf } from './reportFormat'
import type { ReportInputs } from './reportTypes'
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
  /** Peso por etapa (DS-7) — só no estado B-0 da 069, para semanal ou injetável. */
  weightSeries: TreatmentMeasureSeries | null
}

export interface ReportModel {
  generatedAt: string
  header: ReportHeader
  forThisVisit: VisitItem[]
  medications: ReportMedicationRow[]
  intakes: IntakesSection
  changes: ChangeItem[]
  ladders: ReportLadder[]
  /** `null` = rastreio de estoque desligado (044): a seção não existe. */
  stock: StockRow[] | null
}

function _weightSeries(ladder: Ladder, inputs: ReportInputs): TreatmentMeasureSeries | null {
  const protocol = inputs.protocols.find((p) => p.id === ladder.protocolId)
  if (!protocol) return null
  // Regra da 069 (Clarifications): semanal OU injetável.
  const eligible = isInjectable(medicineOf(protocol, inputs.medicines)) || protocol.frequency === 'semanal'
  if (!eligible) return null

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
    from: inputs.window.from,
    to: inputs.window.to,
  })
  return pickMeasureSeriesState(series, inputs.window.to) === 'B0' ? series : null
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
    .map((l) => ({ ...l, weightSeries: _weightSeries(l, inputs) }))

  const intakeById = new Map(intakes.active.map((r) => [r.protocolId, r]))
  const medications: ReportMedicationRow[] = medicationsBase.map((m) => {
    const ranges = pausedRanges(intakeById.get(m.protocolId)?.days ?? [])
    return { ...m, pause: ranges[ranges.length - 1] ?? null }
  })

  const stock = buildStockRows(inputs)
  return {
    generatedAt,
    header: buildHeader(inputs, intakes),
    forThisVisit: buildForThisVisit(medications, stock, ladders, asOf),
    medications,
    intakes,
    changes: buildChanges(inputs, intakes, ladders),
    ladders,
    stock,
  }
}
