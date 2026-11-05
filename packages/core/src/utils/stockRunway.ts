// packages/core/src/utils/stockRunway.ts
// Spec 105 (ex-103-G2) — quando "acabar o estoque" é alarme, e quando é o plano.
//
// Dois tratamentos zeram o estoque DE PROPÓSITO:
//   - cadência esparsa (`interval_days ≥ 28`): injetável mensal se compra 1 por ciclo;
//   - etapa de escada cuja seguinte usa OUTRO medicamento: a caixa atual acaba na troca.
// Neles o `stock_alert` ("estoque baixo") é ruído, e o que serve é a DATA de compra.
//
// INV-1 (R-231): esta é a ÚNICA implementação. Servidor (enqueue + builder), mobile e web consomem
// daqui — reimplementar a regra num app é o drift que a spec proíbe.
// INV-2 (AP-277): dado ausente nunca silencia alerta nem inventa data. `interval_days` NULL/0,
// etapa sem `protocol_id`, escada sem etapa seguinte ⇒ alerta normal.
//
// PURO: sem I/O e sem relógio. Quem busca as linhas e fornece `now`/`tz` é o chamador.

import { getIntervalDays } from './adherenceLogic'
import { doseToMl, isLiquidMedicine } from './doseUnit'
import { cleanFloat } from './formUtils'

/** Cadência a partir da qual o remédio "não se estoca" (spec 105 FR-G1). */
export const SPARSE_INTERVAL_DAYS_MIN = 28

/** Status de etapa que conta como vigente para a troca (FR-G2). */
const LIVE_STEP_STATUSES = new Set(['current', 'pending_confirmation'])

export interface RunwayProtocol {
  id: string
  medicine_id: string
  frequency?: string | null
  interval_days?: number | null
  intake_unit?: string | null
  dosage_per_intake?: number | null
  [key: string]: unknown
}

export interface RunwayStep {
  titration_id: string
  position: number
  medicine_id: string
  status: string
  protocol_id?: string | null
  dose?: number | null
  intake_unit?: string | null
  started_at?: string | null
  duration_days?: number | null
  [key: string]: unknown
}

export interface RunwayInstance {
  id: string
  protocol_id: string
  medicine_id: string
  scheduled_for: string
  expected_dose?: number | null
  status: string
  [key: string]: unknown
}

/** Saldo do medicamento (soma dos lotes) + o que a conversão de líquido precisa. */
export interface RunwayStock {
  qty: number
  dosage_unit?: string | null
  units_per_ml?: number | string | null
  dosage_per_pill?: number | string | null
}

export type SupplyReason = 'sparse' | 'step_switch'

export type SupplyDateResult =
  | { status: 'due'; date: string; medicineId: string; reason: SupplyReason }
  /** Saldo cobre tudo o que é previsível: não há o que comprar agora. */
  | { status: 'covered' }
  /** Elegível, mas sem dose futura nem `duration_days` (AC-4): sem data, sem aviso. */
  | { status: 'no_date' }
  /** Fora do predicado: o `stock_alert` cobre (FR-002). */
  | { status: 'not_eligible' }

/** Cadência esparsa do protocolo. NULL/0/fora da faixa ⇒ false (INV-2). */
export function isSparseProtocol(protocol: Pick<RunwayProtocol, 'interval_days'> | null | undefined): boolean {
  const n = getIntervalDays(protocol as Parameters<typeof getIntervalDays>[0])
  return n !== null && n >= SPARSE_INTERVAL_DAYS_MIN
}

/** Etapa vigente que este protocolo executa, ou null. Sem `protocol_id` não há vínculo (INV-6 da 103). */
function liveStepOf(protocolId: string, steps: RunwayStep[]): RunwayStep | null {
  return steps.find((s) => s.protocol_id === protocolId && LIVE_STEP_STATUSES.has(s.status)) ?? null
}

/** Etapa seguinte = menor `position` acima da atual na mesma escada (C-3: buracos de posição). */
function nextStepOf(step: RunwayStep, steps: RunwayStep[]): RunwayStep | null {
  let next: RunwayStep | null = null
  for (const s of steps) {
    if (s.titration_id !== step.titration_id || s.position <= step.position) continue
    if (!next || s.position < next.position) next = s
  }
  return next
}

/** Etapa de passagem: a seguinte usa OUTRO medicamento. */
function switchingStepOf(protocol: RunwayProtocol, steps: RunwayStep[]): { step: RunwayStep; next: RunwayStep } | null {
  const step = liveStepOf(protocol.id, steps)
  if (!step || step.medicine_id !== protocol.medicine_id) return null
  const next = nextStepOf(step, steps)
  if (!next || next.medicine_id === step.medicine_id) return null
  return { step, next }
}

/**
 * O `stock_alert` faz sentido para este medicamento? (FR-G1..G3)
 *
 * false só quando TODO protocolo ativo do medicamento zera o estoque de propósito — esparso ou
 * etapa de passagem. Basta um protocolo contínuo junto (ex.: diário + mensal) para o alerta voltar
 * (AC-G3). Sem protocolo nenhum ⇒ true: não é este predicado que cala.
 *
 * @param protocols protocolos ATIVOS do usuário para este medicamento
 * @param steps     etapas de escada do usuário (todas — o vínculo é por `protocol_id`)
 */
export function isStockRunwayAlertExpected(
  medicineId: string,
  protocols: RunwayProtocol[] | null | undefined,
  steps: RunwayStep[] | null | undefined,
): boolean {
  const own = (protocols ?? []).filter((p) => p?.medicine_id === medicineId)
  if (own.length === 0) return true
  const ladder = steps ?? []
  return !own.every((p) => isSparseProtocol(p) || switchingStepOf(p, ladder) !== null)
}

/** Data local (YYYY-MM-DD) de um instante no fuso do usuário (R-020). */
function localDateOf(iso: string, tz: string): string | null {
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto timestamptz, não date-only
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(ms)
}

/** Soma N dias de calendário a uma data YYYY-MM-DD (aritmética em UTC puro, imune a DST). */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  // eslint-disable-next-line no-restricted-syntax -- Date.UTC numérico, não parse de string
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Dose na unidade do SALDO (C-2): líquido converte para ml; sólido segue em unidades. */
function doseInStockUnits(dose: number, intakeUnit: string | null | undefined, stock: RunwayStock | undefined): number {
  if (!stock || !isLiquidMedicine(stock)) return dose
  return doseToMl(dose, intakeUnit, stock.units_per_ml, stock.dosage_per_pill)
}

/**
 * Data local da 1ª dose pendente (a partir de hoje) que o saldo não cobre, ou null.
 * `null` em `firstUncovered` com doses à frente = saldo cobre tudo o que está materializado.
 */
function firstUncoveredDate(
  medicineId: string,
  instances: RunwayInstance[],
  protocols: RunwayProtocol[],
  stock: RunwayStock | undefined,
  today: string,
  tz: string,
): { hasFuture: boolean; date: string | null } {
  const intakeUnitBy = new Map(protocols.map((p) => [p.id, p.intake_unit ?? null]))
  const upcoming = instances
    .filter((i) => i.medicine_id === medicineId && i.status === 'pending')
    .map((i) => ({ i, date: localDateOf(i.scheduled_for, tz) }))
    .filter((x): x is { i: RunwayInstance; date: string } => x.date !== null && x.date >= today)
    .sort((a, b) => a.i.scheduled_for.localeCompare(b.i.scheduled_for))

  let balance = cleanFloat(stock?.qty ?? 0)
  for (const { i, date } of upcoming) {
    const dose = Number(i.expected_dose)
    if (!Number.isFinite(dose) || dose <= 0) continue // não consome ⇒ não define D
    const need = doseInStockUnits(dose, intakeUnitBy.get(i.protocol_id), stock)
    if (cleanFloat(balance - need) < 0) return { hasFuture: true, date }
    balance = cleanFloat(balance - need)
  }
  return { hasFuture: upcoming.length > 0, date: null }
}

/**
 * Data de compra D do medicamento (FR-003, emenda E-1).
 *
 * - Esparso: D = data local da 1ª `dose_instance` pendente que o saldo não cobre.
 * - Etapa de passagem: D = menor entre isso e `started_at + duration_days`; o medicamento a
 *   comprar é o da etapa SEGUINTE, e só há o que comprar se o saldo dele não cobre a 1ª dose.
 *
 * @param stocks saldo por `medicine_id` (ausente = 0)
 * @param now    instante do tick — o chamador fornece (116 FR-016: pode ser o minuto-alvo)
 */
export function computeSupplyDate(params: {
  medicineId: string
  protocols: RunwayProtocol[] | null | undefined
  steps: RunwayStep[] | null | undefined
  instances: RunwayInstance[] | null | undefined
  stocks: Record<string, RunwayStock | undefined>
  tz: string
  now: Date
}): SupplyDateResult {
  const { medicineId, stocks, tz, now } = params
  const protocols = (params.protocols ?? []).filter((p) => p?.medicine_id === medicineId)
  const steps = params.steps ?? []
  const instances = params.instances ?? []
  if (isStockRunwayAlertExpected(medicineId, protocols, steps)) return { status: 'not_eligible' }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
  const own = firstUncoveredDate(medicineId, instances, protocols, stocks[medicineId], today, tz)

  // Escada: qualquer protocolo do medicamento executando etapa de passagem decide a troca.
  const switching = protocols.map((p) => switchingStepOf(p, steps)).find((x) => x !== null) ?? null
  if (!switching) {
    if (own.date) return { status: 'due', date: own.date, medicineId, reason: 'sparse' }
    return own.hasFuture ? { status: 'covered' } : { status: 'no_date' }
  }

  const { step, next } = switching
  const startedDate = step.started_at ? localDateOf(step.started_at, tz) : null
  const duration = Number(step.duration_days)
  const stepEnd = startedDate && Number.isInteger(duration) && duration > 0 ? addDays(startedDate, duration) : null

  const candidates = [own.date, stepEnd].filter((d): d is string => d !== null)
  if (candidates.length === 0) return own.hasFuture ? { status: 'covered' } : { status: 'no_date' }
  const date = candidates.sort()[0]

  const nextStock = stocks[next.medicine_id]
  const firstDose = Number(next.dose)
  const need = Number.isFinite(firstDose) && firstDose > 0 ? doseInStockUnits(firstDose, next.intake_unit, nextStock) : 0
  if (need > 0 && cleanFloat((nextStock?.qty ?? 0) - need) >= 0) return { status: 'covered' }

  return { status: 'due', date, medicineId: next.medicine_id, reason: 'step_switch' }
}
