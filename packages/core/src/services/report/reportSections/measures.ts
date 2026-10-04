/**
 * §3.7 Medidas + cruzamento dose × medida por período do dia (spec 097 FR-011/FR-012, ADR-105).
 *
 * - Só os três tipos que o app registra: glicemia, pressão arterial e peso (PO 2026-10-04). Tipo
 *   desconhecido (o banco não tem CHECK) é ignorado.
 * - Dia e período do dia no fuso do dono (ADR-049). O período sai da HORA local (`getPeriodFromTime`,
 *   a mesma régua do app), nos dois lados: `slot` da RPC para a dose, `measured_at` para a medida.
 * - Linha SaMD (INV-5): só contagem, mínimo, mediana e máximo. Nenhuma faixa, meta ou juízo.
 * - Sem medida do tipo no período, o bloco não existe; sem medida nenhuma, a seção é `null` (PO-8).
 */
import { formatBiomarkerContext } from '../../../utils/biomarkerDisplay'
import { getPeriodFromTime, getUserTime, parseISO } from '../../../utils/dateUtils'
import { localDayOf } from '../reportFormat'
import type { ReportInputs } from '../reportTypes'

export const MEASURE_TYPES = ['glicemia', 'pressao_arterial', 'peso'] as const
export type MeasureType = (typeof MEASURE_TYPES)[number]

const TYPE_LABEL: Record<MeasureType, string> = { glicemia: 'Glicemia', pressao_arterial: 'Pressão arterial', peso: 'Peso' }
const TYPE_UNIT: Record<MeasureType, string> = { glicemia: 'mg/dL', pressao_arterial: 'mmHg', peso: 'kg' }

/** Tipos que entram no cruzamento por período do dia: peso por período não descreve nada (o peso por etapa fica na escada). */
const CROSS_TYPES: readonly MeasureType[] = ['glicemia', 'pressao_arterial']

export type DayPeriod = ReturnType<typeof getPeriodFromTime>
const PERIOD_ORDER: readonly DayPeriod[] = ['Manhã', 'Tarde', 'Noite', 'Madrugada']

/** Com menos que isto, o tipo sai só em tabela, sem gráfico (DESIGN_DECISOES §3.7). */
export const MIN_POINTS_FOR_CHART = 3

export interface MeasureStat {
  n: number
  min: number
  median: number
  max: number
}

export interface MeasurePoint {
  day: string
  time: string
  period: DayPeriod
  value: number
  /** Diastólica (pressão); `null` nos demais ou quando não registrada. */
  secondary: number | null
  /** Contexto cru (`jejum`, `em_repouso`…), ou `null`. */
  context: string | null
  /** Rótulo PT do contexto, ou `null` se vazio/desconhecido. */
  contextLabel: string | null
}

export interface MeasureContextGroup {
  /** Contexto cru; `null` agrupa "sem momento" (vazio ou desconhecido). */
  context: string | null
  label: string
  stat: MeasureStat
  /** Estatística da diastólica (pressão), quando houver. */
  secondary: MeasureStat | null
}

export interface MeasureBlock {
  type: MeasureType
  label: string
  unit: string
  /** Em ordem cronológica. */
  points: MeasurePoint[]
  byContext: MeasureContextGroup[]
  chart: boolean
}

export interface CrossMeasure {
  type: MeasureType
  label: string
  unit: string
  stat: MeasureStat
  secondary: MeasureStat | null
}

export interface CrossRow {
  period: DayPeriod
  dosesTaken: number
  measures: CrossMeasure[]
}

export interface MeasuresSection {
  blocks: MeasureBlock[]
  /** Cruzamento por período do dia; vazio quando não há glicemia nem pressão. */
  cross: CrossRow[]
}

/** n, mínimo, mediana e máximo. `null` sem valores. Mediana com n par = média dos dois centrais. */
export function measureStat(values: number[]): MeasureStat | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  return { n: sorted.length, min: sorted[0], median, max: sorted[sorted.length - 1] }
}

function isMeasureType(type: string): type is MeasureType {
  return (MEASURE_TYPES as readonly string[]).includes(type)
}

function localTimeOf(iso: string, tz: string): string | null {
  const date = parseISO(iso)
  if (Number.isNaN(date.getTime())) return null
  const local = getUserTime(date, tz)
  return `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`
}

function secondaryStat(points: MeasurePoint[]): MeasureStat | null {
  return measureStat(points.map((p) => p.secondary).filter((v): v is number => v !== null))
}

function contextGroups(points: MeasurePoint[]): MeasureContextGroup[] {
  const groups = new Map<string | null, MeasurePoint[]>()
  for (const p of points) {
    const key = p.contextLabel ? p.context : null
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .map(([context, list]) => ({
      context,
      label: list[0].contextLabel ?? 'sem momento',
      stat: measureStat(list.map((p) => p.value)) as MeasureStat,
      secondary: secondaryStat(list),
    }))
    .sort((a, b) => (a.context === null ? 1 : b.context === null ? -1 : a.label.localeCompare(b.label, 'pt-BR')))
}

export function buildMeasuresSection(inputs: ReportInputs): MeasuresSection | null {
  const { from, to } = inputs.window
  const byType = new Map<MeasureType, MeasurePoint[]>()
  for (const b of inputs.biomarkers) {
    if (!isMeasureType(b.type) || !Number.isFinite(b.value)) continue
    const day = localDayOf(b.measured_at, inputs.timezone)
    const time = localTimeOf(b.measured_at, inputs.timezone)
    if (!day || !time || day < from || day > to) continue
    const list = byType.get(b.type) ?? []
    list.push({
      day,
      time,
      period: getPeriodFromTime(time),
      value: b.value,
      secondary: Number.isFinite(b.value_secondary) ? (b.value_secondary as number) : null,
      context: b.context,
      contextLabel: formatBiomarkerContext(b.context),
    })
    byType.set(b.type, list)
  }
  if (byType.size === 0) return null

  const blocks: MeasureBlock[] = MEASURE_TYPES.filter((t) => byType.has(t)).map((type) => {
    const points = (byType.get(type) as MeasurePoint[]).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time))
    return {
      type,
      label: TYPE_LABEL[type],
      unit: TYPE_UNIT[type],
      points,
      byContext: contextGroups(points),
      chart: type === 'glicemia' && points.length >= MIN_POINTS_FOR_CHART,
    }
  })

  return { blocks, cross: buildCross(inputs, blocks) }
}

function buildCross(inputs: ReportInputs, blocks: MeasureBlock[]): CrossRow[] {
  const crossBlocks = blocks.filter((b) => CROSS_TYPES.includes(b.type))
  if (!crossBlocks.length) return []

  const { from, to } = inputs.window
  const doses = new Map<DayPeriod, number>()
  for (const r of inputs.doseDays) {
    if (r.day < from || r.day > to || r.taken_count <= 0) continue
    const period = getPeriodFromTime(r.slot)
    doses.set(period, (doses.get(period) ?? 0) + r.taken_count)
  }

  const rows: CrossRow[] = []
  for (const period of PERIOD_ORDER) {
    const measures: CrossMeasure[] = []
    for (const block of crossBlocks) {
      const points = block.points.filter((p) => p.period === period)
      const stat = measureStat(points.map((p) => p.value))
      if (!stat) continue
      measures.push({ type: block.type, label: block.label, unit: block.unit, stat, secondary: secondaryStat(points) })
    }
    // Período sem medida não entra: o cruzamento é a leitura das medidas ao lado das doses daquele recorte.
    if (measures.length) rows.push({ period, dosesTaken: doses.get(period) ?? 0, measures })
  }
  return rows
}
