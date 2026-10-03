/**
 * §3.5 Mudanças no período — só fatos com fonte DATADA no banco (DESIGN_DECISOES §6, RC3-F8):
 * etapa iniciada (`titration_steps.started_at`), pausa (dias `skipped_paused` do agregado — não
 * `paused_at`, que a retomada apaga), início (`start_date`), término (`end_date`) e exclusão
 * (`archived_at`, 094). Mudança sem fonte datada não entra.
 */
import { localDayOf, medicineOf, shiftDay, treatmentName } from '../reportFormat'
import type { ReportInputs } from '../reportTypes'
import type { IntakesSection } from './intakes'
import type { Ladder } from './ladders'

export type ChangeKind = 'titration_step' | 'paused' | 'started' | 'ended' | 'archived'

export interface ChangeItem {
  day: string
  kind: ChangeKind
  protocolId: string
  name: string
  /** Para pausa: último dia da pausa. */
  until: string | null
  /** Para etapa: dose anterior e nova. */
  fromDose: string | null
  toDose: string | null
}

/** Faixas contíguas de dias pausados de uma linha de tomadas. */
export function pausedRanges(days: { day: string; state: string }[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = []
  for (const { day, state } of days) {
    if (state !== 'paused') continue
    const last = out[out.length - 1]
    if (last && shiftDay(last.to, 1) === day) last.to = day
    else out.push({ from: day, to: day })
  }
  return out
}

export function buildChanges(inputs: ReportInputs, intakes: IntakesSection, ladders: Ladder[]): ChangeItem[] {
  const { from, to } = inputs.window
  const inWindow = (d: string | null): d is string => d !== null && d >= from && d <= to
  const items: ChangeItem[] = []
  const base = { until: null, fromDose: null, toDose: null }

  for (const ladder of ladders) {
    ladder.steps.forEach((step, i) => {
      if (i === 0 || step.planned || !inWindow(step.start)) return
      items.push({
        ...base,
        day: step.start,
        kind: 'titration_step',
        protocolId: ladder.protocolId,
        name: ladder.name,
        fromDose: ladder.steps[i - 1].doseLabel,
        toDose: step.doseLabel,
      })
    })
  }

  for (const row of [...intakes.active, ...intakes.ended]) {
    for (const r of pausedRanges(row.days)) {
      items.push({ ...base, day: r.from, kind: 'paused', protocolId: row.protocolId, name: row.name, until: r.to })
    }
  }

  for (const protocol of inputs.protocols) {
    const name = treatmentName(protocol, medicineOf(protocol, inputs.medicines))
    if (inWindow(protocol.start_date)) items.push({ ...base, day: protocol.start_date, kind: 'started', protocolId: protocol.id, name })
    if (inWindow(protocol.end_date)) items.push({ ...base, day: protocol.end_date, kind: 'ended', protocolId: protocol.id, name })
    const archived = localDayOf(protocol.archived_at, inputs.timezone)
    if (inWindow(archived)) items.push({ ...base, day: archived, kind: 'archived', protocolId: protocol.id, name })
  }

  const order: Record<ChangeKind, number> = { started: 0, titration_step: 1, paused: 2, ended: 3, archived: 4 }
  return items.sort((a, b) => (a.day === b.day ? order[a.kind] - order[b.kind] : a.day < b.day ? -1 : 1))
}
