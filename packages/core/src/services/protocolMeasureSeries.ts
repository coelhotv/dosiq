/**
 * protocolMeasureSeries — ponte tratamento/escada → série de medida × etapa (069 Ba).
 *
 * Uma ponte só, usada pelo relatório clínico (097) e pelo card do detalhe do tratamento (069-B):
 * duplicar a conversão no mobile deixaria card e PDF divergindo em silêncio (classe R-231).
 *
 * Puro: recebe as linhas cruas da escada (`titration_steps`, mesmo shape no coletor do relatório e
 * no `getLadderForProtocol` do mobile), o tratamento, os cadastros e as contagens diárias de dose
 * (RPC `report_dose_days`). Sem copy de UI além do rótulo de dose que o relatório já usa.
 */
import { formatDosePerIntake, formatStepDose, localDayOf, shiftDay } from './report/reportFormat'
import type { ReportMedicineRow, ReportProtocolRow, ReportTitrationStepRow } from './report/reportTypes'
import { isInjectable } from '../utils/injectionSites'
import {
  buildTreatmentMeasureSeries,
  pickMeasureSeriesState,
  type MeasureInput,
  type MeasureSeriesState,
  type MeasureStepInput,
  type TreatmentMeasureSeries,
} from './treatmentMeasureSeries'

/** Campos do cadastro que o rótulo de dose e a elegibilidade leem (o embed do mobile tem só estes). */
export type MeasureBridgeMedicine = Pick<
  ReportMedicineRow,
  'id' | 'presentation' | 'dosage_unit' | 'dosage_per_pill' | 'units_per_ml' | 'concentration_volume_ml'
>

export type MeasureBridgeProtocol = Pick<
  ReportProtocolRow,
  'id' | 'medicine_id' | 'frequency' | 'intake_unit' | 'dosage_per_intake' | 'start_date'
>

export type MeasureBridgeStepRow = Pick<
  ReportTitrationStepRow,
  'position' | 'medicine_id' | 'dose' | 'intake_unit' | 'duration_days' | 'status' | 'started_at' | 'ended_at'
>

export interface MeasureBridgeDoseDay {
  protocol_id: string | null
  day: string
  taken_count: number
  missed_count: number
}

export interface LadderStepDays<M> {
  doseLabel: string
  /** `null` = contínua (última etapa sem fim). */
  durationDays: number | null
  /** Dia local de início (real ou previsto). */
  start: string | null
  /** Dia local de fim (real ou previsto); `null` = sem fim. */
  end: string | null
  /** Datas previstas (etapa ainda não iniciada). */
  planned: boolean
  /** Cadastro do degrau (o do tratamento quando a etapa não diz). */
  medicine: M | null
}

/**
 * Datas e rótulo de dose de cada etapa, na ordem recebida. Etapa iniciada usa `started_at`/`ended_at`
 * reais; etapa futura é PREVISTA, encadeada a partir do fim previsto da anterior (`duration_days`).
 * Cada degrau carrega o próprio medicamento (R-299: escada cross-medicamento troca de cadastro).
 */
export function ladderStepDays<M extends MeasureBridgeMedicine>(
  ordered: MeasureBridgeStepRow[],
  protocol: MeasureBridgeProtocol,
  medicines: M[],
  timezone: string
): LadderStepDays<M>[] {
  const protoMedicine = medicines.find((m) => m.id === protocol.medicine_id) ?? null
  let prevEnd: string | null = null
  return ordered.map((step) => {
    const stepMedicine = medicines.find((m) => m.id === step.medicine_id) ?? protoMedicine
    const dose = formatStepDose(step, protocol, stepMedicine) ?? '-'
    const duration = Number(step.duration_days)
    const durationDays = Number.isFinite(duration) && duration > 0 ? duration : null
    const startedDay = localDayOf(step.started_at, timezone)
    const start = startedDay ?? prevEnd
    const endedDay = localDayOf(step.ended_at, timezone)
    const end = endedDay ?? (start && durationDays ? shiftDay(start, durationDays) : null)
    prevEnd = end
    return { doseLabel: dose, durationDays, start, end, planned: startedDay === null, medicine: stepMedicine }
  })
}

export interface BuildProtocolMeasureSeriesArgs {
  biomarkerType: string
  protocol: MeasureBridgeProtocol
  medicines: MeasureBridgeMedicine[]
  /** Linhas cruas da escada do tratamento (qualquer ordem); `[]` = sem titulação. */
  steps: MeasureBridgeStepRow[]
  measures: MeasureInput[]
  doseDays: MeasureBridgeDoseDay[]
  timezone: string
  /** Dia local de referência e fim da janela (card: hoje; relatório: último dia do período). */
  to: string
  /** Piso da janela (relatório: 1º dia do período). Sem piso, a janela começa na 1ª etapa. */
  floor?: string
}

export interface ProtocolMeasureSeries {
  series: TreatmentMeasureSeries
  state: MeasureSeriesState
}

/**
 * Série do tratamento, ou `null` se o tratamento não é elegível (069 R-11: semanal OU injetável).
 *
 * - Escada com 2+ etapas: uma etapa por degrau; prevista não vira faixa.
 * - Sem escada ou escada de 1 etapa (E-B6): 1 etapa sintética desde `start_date`, a vigente (AC-8b).
 * - Janela: da 1ª etapa iniciada (recortada ao piso) até `to`.
 * - Doses: só as do PRÓPRIO tratamento, pelo `protocol_id` da linha do fato (RC3 E-B1, R-299) —
 *   o "fora das etapas" do relatório subtrai esta soma das tomadas do mesmo tratamento.
 */
export function buildProtocolMeasureSeries({
  biomarkerType,
  protocol,
  medicines,
  steps,
  measures,
  doseDays,
  timezone,
  to,
  floor,
}: BuildProtocolMeasureSeriesArgs): ProtocolMeasureSeries | null {
  const medicine = medicines.find((m) => m.id === protocol.medicine_id) ?? null
  if (!isInjectable(medicine) && protocol.frequency !== 'semanal') return null

  let seriesSteps: MeasureStepInput[]
  let firstStart: string | null
  if (steps.length >= 2) {
    const ordered = [...steps].sort((a, b) => a.position - b.position)
    const days = ladderStepDays(ordered, protocol, medicines, timezone)
    seriesSteps = days.map((d, i) => ({
      doseLabel: d.doseLabel,
      start: d.planned ? null : d.start,
      end: d.end,
      current: ordered[i].status === 'current',
    }))
    firstStart = days.find((d) => !d.planned && d.start)?.start ?? null
  } else {
    firstStart = protocol.start_date ?? null
    seriesSteps = [{ doseLabel: formatDosePerIntake(protocol, medicine), start: firstStart, end: null, current: true }]
  }

  const byDay = new Map<string, { day: string; taken: number; missed: number }>()
  for (const r of doseDays) {
    if (r.protocol_id !== protocol.id) continue
    const d = byDay.get(r.day) ?? { day: r.day, taken: 0, missed: 0 }
    d.taken += r.taken_count
    d.missed += r.missed_count
    byDay.set(r.day, d)
  }

  const from = firstStart && (floor === undefined || firstStart > floor) ? firstStart : (floor ?? to)
  const series = buildTreatmentMeasureSeries({
    biomarkerType,
    measures,
    steps: seriesSteps,
    doseDays: [...byDay.values()],
    timezone,
    from,
    to,
  })
  return { series, state: pickMeasureSeriesState(series, to) }
}
