/**
 * treatmentMeasureSeries — medida × etapa do tratamento (contrato da 069 FR-010/FR-012, criado pela
 * 097 DS-7 e consumido pelo relatório clínico e pelo card da 069-B).
 *
 * Puro: o chamador traz as medidas, as etapas (sem titulação ⇒ 1 etapa) e as contagens diárias de
 * dose. Sem copy, sem cor, sem juízo: nada de diferença calculada nem média desenhada (ADR-062).
 *
 * - Agregação por DIA LOCAL do dono; várias medidas no mesmo dia ⇒ vale a mais recente.
 * - Adesão por etapa = taken / (taken + missed) do período da etapa (ADR-054, mesmo denominador
 *   binário de `computeAdherenceFromInstances`); pausado/pulado/pendente fora.
 * - Etapa iniciada antes da janela é cortada no início (`clipped`).
 */
import { localDayOf, shiftDay, daysBetween } from './report/reportFormat'

export interface MeasureInput {
  type: string
  value: number
  measured_at: string
}

export interface MeasureStepInput {
  doseLabel: string
  /** Dia local de início; `null` = sem data (etapa não iniciada — ignorada). */
  start: string | null
  /** Dia local de fim (exclusivo: o dia em que a próxima começa); `null` = em aberto. */
  end: string | null
  current: boolean
}

export interface DoseDayCount {
  day: string
  taken: number
  missed: number
}

export interface MeasureSeriesStep {
  index: number
  dose: string
  start: string
  end: string | null
  /** A etapa começou antes da janela e foi cortada. */
  clipped: boolean
  meanKg: number | null
  count: number
  taken: number
  expected: number
  current: boolean
}

export interface TreatmentMeasureSeries {
  points: { day: string; kg: number }[]
  steps: MeasureSeriesStep[]
  firstDay: string | null
  lastDay: string | null
}

/** Estados do card/gráfico (069 FR-009), avaliados B-0 → B-2 → B-1 → B-3. */
export type MeasureSeriesState = 'B0' | 'B1' | 'B2' | 'B3'

export const MEASURE_SERIES_MIN_POINTS = 3
export const MEASURE_SERIES_MIN_SPAN_DAYS = 14

export interface BuildTreatmentMeasureSeriesArgs {
  biomarkerType: string
  measures: MeasureInput[]
  steps: MeasureStepInput[]
  doseDays: DoseDayCount[]
  timezone: string
  /** Janela local inclusiva (relatório: o período; 069: início da 1ª etapa até hoje). */
  from: string
  to: string
}

function _inStep(day: string, start: string, end: string | null): boolean {
  return day >= start && (end === null || day < end)
}

/** Um ponto por dia local na janela: a medida mais recente do dia. */
function _dailyPoints(measures: MeasureInput[], type: string, tz: string, from: string, to: string) {
  const latest = new Map<string, { at: string; value: number }>()
  for (const m of measures) {
    const value = Number(m.value)
    const day = m.type === type && Number.isFinite(value) ? localDayOf(m.measured_at, tz) : null
    if (!day || day < from || day > to) continue
    const prev = latest.get(day)
    if (!prev || m.measured_at > prev.at) latest.set(day, { at: m.measured_at, value })
  }
  return [...latest.entries()]
    .map(([day, v]) => ({ day, kg: v.value }))
    .sort((a, b) => (a.day < b.day ? -1 : 1))
}

/** Etapa recortada à janela, ou `null` se não cruza a janela. */
function _clipStep(s: MeasureStepInput, from: string, to: string): { start: string; end: string | null } | null {
  if (!s.start || s.start > to || (s.end !== null && s.end <= from)) return null
  return { start: s.start < from ? from : s.start, end: s.end !== null && s.end > to ? null : s.end }
}

function _doseCounts(doseDays: DoseDayCount[], start: string, end: string | null, from: string, to: string) {
  let taken = 0
  let missed = 0
  for (const d of doseDays) {
    if (d.day < from || d.day > to || !_inStep(d.day, start, end)) continue
    taken += d.taken
    missed += d.missed
  }
  return { taken, expected: taken + missed }
}

function _mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10
}

export function buildTreatmentMeasureSeries({
  biomarkerType,
  measures,
  steps,
  doseDays,
  timezone,
  from,
  to,
}: BuildTreatmentMeasureSeriesArgs): TreatmentMeasureSeries {
  const points = _dailyPoints(measures, biomarkerType, timezone, from, to)
  const seriesSteps: MeasureSeriesStep[] = []
  for (const s of steps) {
    const clip = _clipStep(s, from, to)
    if (!clip) continue
    const inStep = points.filter((p) => _inStep(p.day, clip.start, clip.end)).map((p) => p.kg)
    seriesSteps.push({
      index: seriesSteps.length + 1,
      dose: s.doseLabel,
      start: clip.start,
      end: clip.end,
      clipped: (s.start as string) < from,
      meanKg: _mean(inStep),
      count: inStep.length,
      ..._doseCounts(doseDays, clip.start, clip.end, from, to),
      current: s.current,
    })
  }

  return {
    points,
    steps: seriesSteps,
    firstDay: points[0]?.day ?? null,
    lastDay: points[points.length - 1]?.day ?? null,
  }
}

/**
 * Estado do gráfico (069 FR-009). `today` = dia local de referência (relatório: último dia do
 * período). B-0 exige ≥ 3 dias com medida E ≥ 14 dias entre a primeira e a última.
 */
export function pickMeasureSeriesState(series: TreatmentMeasureSeries, today: string): MeasureSeriesState {
  const n = series.points.length
  const d1 = series.firstDay
  if (n >= MEASURE_SERIES_MIN_POINTS && d1 && series.lastDay) {
    return daysBetween(d1, series.lastDay) >= MEASURE_SERIES_MIN_SPAN_DAYS ? 'B0' : 'B2'
  }
  if (n >= 1 && d1 && today >= shiftDay(d1, MEASURE_SERIES_MIN_SPAN_DAYS)) return 'B1'
  return 'B3'
}
