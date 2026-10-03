/**
 * §3.4 Tomadas no período e §3.6 Tratamentos encerrados (DESIGN_DECISOES; spec 097 FR-004, INV-1).
 *
 * Fonte: o agregado da RPC `report_dose_days` (fato — `dose_instances`). Quem entra na seção é
 * quem TEM dose no período, não quem está vivo hoje: tratamento arquivado ou pausado conta nos
 * dias em que existiu (094 FR-014, R-299). O estado atual do tratamento só decide em QUAL das duas
 * seções ele aparece (encerrado no período → §3.6).
 *
 * Adesão = taken / (taken + missed); pausado, pulado e pendente ficam fora do denominador (ADR-054).
 * Percentual nunca aparece sem a contagem e é `null` com denominador 0.
 */
import {
  compareTreatments,
  firstSlot,
  isInjectable,
  localDayOf,
  medicineOf,
  treatmentName,
  windowDays,
} from '../reportFormat'
import type { ReportDoseDayRow, ReportInputs, ReportProtocolRow } from '../reportTypes'

/** Estado de um dia na faixa (§3.4). Categórico, legível em preto e branco. */
export type DayCellState = 'full' | 'partial' | 'none' | 'paused' | 'empty'

/** Rótulo do agrupamento dos horários que não estão na agenda atual do tratamento. */
export const OTHER_SLOTS_LABEL = 'outros horários'

export interface SlotCount {
  slot: string
  taken: number
  expected: number
}

export interface IntakeRow {
  protocolId: string
  medicineId: string
  name: string
  injectable: boolean
  taken: number
  expected: number
  /** 0–100 inteiro; `null` sem denominador. */
  percent: number | null
  days: { day: string; state: DayCellState }[]
  bySlot: SlotCount[]
  /** Dia local em que o tratamento foi encerrado/excluído (só §3.6). */
  endedOn: string | null
}

export interface IntakesSection {
  active: IntakeRow[]
  ended: IntakeRow[]
}

interface DayTotals {
  taken: number
  missed: number
  paused: number
}

function _cellState(t: DayTotals | undefined): DayCellState {
  if (!t) return 'empty'
  const expected = t.taken + t.missed
  if (expected === 0) return t.paused > 0 ? 'paused' : 'empty'
  if (t.taken === expected) return 'full'
  return t.taken > 0 ? 'partial' : 'none'
}

/**
 * Dia em que o tratamento deixou de existir DENTRO da janela, ou `null`.
 * Arquivado (094) ou término (`end_date`) até o último dia do período.
 */
export function endedOnInWindow(protocol: ReportProtocolRow, to: string, tz: string): string | null {
  // `end_date` é o último dia VIGENTE (inclusivo): término no último dia do período ainda está em
  // uso. Arquivar no último dia já tirou o tratamento da lista do presente (CON-039).
  const candidates: string[] = []
  const archivedDay = localDayOf(protocol.archived_at, tz)
  if (archivedDay && archivedDay <= to) candidates.push(archivedDay)
  if (protocol.end_date && protocol.end_date < to) candidates.push(protocol.end_date)
  if (candidates.length === 0) return null
  return candidates.sort()[0]
}

/**
 * Só os horários da agenda atual aparecem um a um; os antigos (agenda mudou no período) somam em
 * "outros horários" — dezenas de horários soltos não dizem nada na consulta (smoke 097 A2).
 */
function _slotKeyFor(protocol: ReportProtocolRow | null): (slot: string) => string {
  const schedule = new Set((protocol?.time_schedule ?? []).filter((t) => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)))
  return (slot) => (schedule.size === 0 || schedule.has(slot) ? slot : OTHER_SLOTS_LABEL)
}

function _buildRow(
  protocolId: string,
  rows: ReportDoseDayRow[],
  inputs: ReportInputs,
  days: string[]
): IntakeRow & { firstSlot: string } {
  const protocol = inputs.protocols.find((p) => p.id === protocolId) ?? null
  // R-299: o medicamento é o do FATO (linha da RPC), não o do tratamento de hoje.
  const medicineId = rows[0].medicine_id
  const medicine = inputs.medicines.find((m) => m.id === medicineId) ?? (protocol ? medicineOf(protocol, inputs.medicines) : null)

  const slotKey = _slotKeyFor(protocol)
  const byDay = new Map<string, DayTotals>()
  const bySlot = new Map<string, SlotCount>()
  let taken = 0
  let missed = 0
  for (const r of rows) {
    const d = byDay.get(r.day) ?? { taken: 0, missed: 0, paused: 0 }
    d.taken += r.taken_count
    d.missed += r.missed_count
    d.paused += r.paused_count
    byDay.set(r.day, d)
    const key = slotKey(r.slot)
    const s = bySlot.get(key) ?? { slot: key, taken: 0, expected: 0 }
    s.taken += r.taken_count
    s.expected += r.taken_count + r.missed_count
    bySlot.set(key, s)
    taken += r.taken_count
    missed += r.missed_count
  }
  const expected = taken + missed
  const rank = (slot: string) => (slot === OTHER_SLOTS_LABEL ? '~' : slot)
  const slots = [...bySlot.values()].filter((s) => s.expected > 0).sort((a, b) => (rank(a.slot) < rank(b.slot) ? -1 : 1))

  return {
    protocolId,
    medicineId,
    name: protocol ? treatmentName(protocol, medicine) : medicine?.name ?? 'Tratamento sem nome',
    injectable: isInjectable(medicine),
    taken,
    expected,
    percent: expected > 0 ? Math.round((taken / expected) * 100) : null,
    days: days.map((day) => ({ day, state: _cellState(byDay.get(day)) })),
    bySlot: slots,
    endedOn: protocol ? endedOnInWindow(protocol, inputs.window.to, inputs.timezone) : null,
    firstSlot: protocol ? firstSlot(protocol) : slots[0]?.slot ?? '99:99',
  }
}

/** Monta §3.4 e §3.6 a partir do agregado. Tratamento sem nenhuma dose prevista fica de fora. */
export function buildIntakesSection(inputs: ReportInputs): IntakesSection {
  const days = windowDays(inputs.window)
  const grouped = new Map<string, ReportDoseDayRow[]>()
  for (const row of inputs.doseDays) {
    if (row.day < inputs.window.from || row.day > inputs.window.to) continue
    const list = grouped.get(row.protocol_id) ?? []
    list.push(row)
    grouped.set(row.protocol_id, list)
  }

  const built = [...grouped.entries()].map(([id, rows]) => _buildRow(id, rows, inputs, days))
  // Linha só de pulos/pendentes não tem dose prevista (§3.4: "com dose prevista no período"),
  // mas uma de pausa tem: o traço da pausa É a informação (US1-AC3).
  const withDose = built.filter((r) => r.expected > 0 || r.days.some((d) => d.state === 'paused'))
  const sorted = withDose.sort(compareTreatments)
  const strip = (row: IntakeRow & { firstSlot: string }): IntakeRow => {
    const { firstSlot, ...rest } = row
    void firstSlot
    return rest
  }

  return {
    active: sorted.filter((r) => r.endedOn === null).map(strip),
    ended: sorted.filter((r) => r.endedOn !== null).map(strip),
  }
}
