/**
 * doseActivityState — Núcleo da máquina de estados de dose (Spec 039 / F1)
 *
 * Deriva o `DoseActivityState` efêmero (não persistido) que alimenta as superfícies
 * de "estado contínuo" de uma dose: Live Activity + Dynamic Island (iOS) e ongoing
 * notification (Android). É a ÚNICA fonte da máquina de estados — as superfícies
 * nativas só renderizam o que este módulo decide (Constituição V — lógica no core,
 * paridade web↔mobile).
 *
 * Server-free: o estado é função pura de `(dose, now)`. Mapeia 1:1 das zonas
 * temporais de `classifyDose` (CON-024) para os estados da superfície, e expõe
 * `remainingSeconds` como base do timer vivo (`Text(timerInterval:)` no iOS,
 * `Chronometer` no Android) — o relógio corre sozinho, sem update remoto.
 *
 * Puro: sem APIs do navegador, env vars ou estado global. `now` injetável
 * (default `getRawNow()`, respeita offset de dev). Aditivo a CON-024 (não altera
 * `classifyDose`); novo CON candidato no C5.
 *
 * @module doseActivityState
 */

import { getRawNow, parseISO } from './dateUtils'
import { DOSE_ZONE_WINDOWS } from './doseZones'

/**
 * Estados da superfície de dose (derivados, efêmeros). Subconjunto estável que as
 * superfícies nativas conhecem — NÃO é o enum de status do DB (`pending`/`taken`/...).
 * @readonly
 */
export const DOSE_ACTIVITY_STATES = Object.freeze({
  LATER: 'later', // distante (60–240min antes) — info, SEM cronômetro
  UPCOMING: 'upcoming', // próxima (10–60min antes) — countdown regressivo
  NOW: 'now', // hora da dose (±10min do horário) — janela de ação
  LATE: 'late', // atrasada (>10min depois, dentro da tolerância) — count-up
  DONE: 'done', // registrada — superfície encerra (cancel-on-resolve)
  MISSED: 'missed', // passou da tolerância sem registro — terminal
} as const)

export type DoseActivityStateValue = (typeof DOSE_ACTIVITY_STATES)[keyof typeof DOSE_ACTIVITY_STATES]

interface DoseActivityItemInput {
  scheduledFor?: string | Date | null
  scheduled_for?: string | Date | null
  isRegistered?: boolean
  status?: string
  toleranceMinutes?: number | null
  tolerance_minutes?: number | null
  instanceId?: string | null
  id?: string | null
  treatmentPlanId?: string | null
  treatment_plan_id?: string | null
  critical?: boolean
  critical_alarm?: boolean
  medicineName?: string | null
  medicine?: { name?: string | null } | null
}

interface SurfaceWindows {
  laterMinutes: number
  upcomingMinutes: number
  lateMinutes: number
  nowBeforeMinutes: number
  nowAfterMinutes: number
}

export interface DoseActivityState {
  state: DoseActivityStateValue
  instanceId: string | null
  treatmentId: string | null
  scheduledFor: string | Date | null
  remainingSeconds: number | null
  isCritical: boolean
  isRegistered: boolean
  medicineLabel: string
}

/**
 * Janelas (minutos até a dose, `d = scheduled - now`; + futuro, − passado) da máquina de estados
 * da SUPERFÍCIE (Spec 039). ALINHADAS aos defaults de `classifyDose`/CON-024 (DOSE_ZONE_WINDOWS) —
 * a superfície reusa as MESMAS fronteiras da timeline web (later/upcoming/late) e só define o que é
 * próprio dela: o `now` estreito que straddle o horário (±nowBefore/After). `tol` da ocorrência
 * sobrescreve `lateMinutes`. Overridáveis via `opts` (teste / futura sobrescrita por superfície).
 *  later:    60 ≤ d < 240        (sem crono)
 *  upcoming: 10 ≤ d < 60         (countdown)
 *  now:      −10 ≤ d < 10        (countdown até 0, depois "agora")
 *  late:     −tol ≤ d < −10      (count-up; tol = tolerância da dose ?? lateMinutes)
 *  missed:   d < −tol  ·  d ≥ 240 → null (sem superfície)
 * @private
 */
const SURFACE_WINDOWS = Object.freeze({
  laterMinutes: DOSE_ZONE_WINDOWS.upcomingWindowMinutes, // 240 — limite p/ exibir (acima → null)
  upcomingMinutes: DOSE_ZONE_WINDOWS.nowWindowMinutes, // 60 — later→upcoming (começa o countdown)
  lateMinutes: DOSE_ZONE_WINDOWS.lateWindowMinutes, // 120 — cutoff de atraso (fallback s/ tolerância)
  nowBeforeMinutes: 10, // upcoming→now (próprio da superfície)
  nowAfterMinutes: 10, // now→late (próprio da superfície)
})

/**
 * Tipo DoseActivityState — estado efêmero de uma dose para a superfície contínua.
 * @typedef {Object} DoseActivityState
 * @property {'later'|'upcoming'|'now'|'late'|'done'|'missed'} state
 * @property {string|null} instanceId - âncora p/ registro (`dose_instances.id`)
 * @property {string|null} treatmentId - agrupamento por plano (`treatment_plan_id`)
 * @property {string|null} scheduledFor - ISO absoluto do agendamento
 * @property {number|null} remainingSeconds - `scheduledFor - now` em segundos
 *   (negativo quando atrasada → base do count-up). `null` se sem instante válido.
 * @property {boolean} isCritical - dose crítica (gate 15min vs 5min / Critical Alerts)
 * @property {boolean} isRegistered - já tomada (→ state 'done')
 * @property {string} medicineLabel - nome p/ exibição
 */

/**
 * Lê um campo aceitando tanto a forma DoseItem (camelCase, já joinado) quanto a
 * dose_instance crua (snake_case). O pipeline normal entrega DoseItem
 * (`buildDoseItemsFromInstances`), mas o derivador tolera a instância crua p/ não
 * acoplar o chamador a uma única forma.
 * @private
 */
function pick<T>(item: DoseActivityItemInput, camel: keyof DoseActivityItemInput, snake: keyof DoseActivityItemInput): T | null {
  return ((item[camel] as T | null | undefined) ?? (item[snake] as T | null | undefined) ?? null)
}

/** Instante é válido se presente e parseável. @private */
function instantMs(scheduledFor: string | Date | null | undefined): number | null {
  if (!scheduledFor) return null
  const ms = scheduledFor instanceof Date ? scheduledFor.getTime() : parseISO(scheduledFor).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Normaliza `now` (Date OU ISO string; paridade com splitDayTimeline/CON-024). Date inválido /
 * string não-parseável → getRawNow() (R-020, evita RangeError no Intl). @private
 */
function resolveNow(now: Date | string | null | undefined): Date {
  const d = now instanceof Date ? now : now ? parseISO(now) : getRawNow()
  return Number.isNaN(d.getTime()) ? getRawNow() : d
}

/**
 * Resolve o estado da superfície a partir de `d` (minutos até a dose) + tolerância, segundo
 * as janelas da SUPERFÍCIE (não de classifyDose). Retorna `null` quando não há superfície
 * (dose distante demais, d ≥ later). `missed` quando passou da tolerância.
 * @private
 */
function resolveSurfaceState(
  diffMinutes: number,
  toleranceMinutes: number | null | undefined,
  w: SurfaceWindows
): DoseActivityStateValue | null {
  const tol = toleranceMinutes ?? w.lateMinutes // tolerância da ocorrência > fallback (lateMinutes)
  if (diffMinutes >= w.laterMinutes) return null // distante demais → sem superfície
  if (diffMinutes >= w.upcomingMinutes) return DOSE_ACTIVITY_STATES.LATER
  if (diffMinutes >= w.nowBeforeMinutes) return DOSE_ACTIVITY_STATES.UPCOMING
  if (diffMinutes >= -w.nowAfterMinutes) return DOSE_ACTIVITY_STATES.NOW
  if (diffMinutes >= -tol) return DOSE_ACTIVITY_STATES.LATE
  return DOSE_ACTIVITY_STATES.MISSED
}

/**
 * Deriva o `DoseActivityState` de uma dose (DoseItem ou dose_instance crua).
 *
 * Máquina de estados PRÓPRIA da superfície (Spec 039) — NÃO usa `classifyDose` (que tem janelas
 * da timeline web). Estados por `d = scheduled - now` (min): later/upcoming/now/late + done/missed.
 * Dois `null` distintos:
 * - instante ausente/inválido → `null` (sem superfície — não há o que mostrar).
 * - instante válido mas distante (d ≥ 240min) → `null` (ainda não exibe).
 * - instante válido além da tolerância → `'missed'` (terminal, superfície honesta).
 *
 * Dose registrada → `'done'` direto.
 *
 * @param {Object|null} item - DoseItem ({instanceId, scheduledFor, ...}) ou dose_instance crua
 * @param {Date|string} [now=getRawNow()] - "agora" injetável (Date ou ISO string); NULL/Invalid → getRawNow() (R-020)
 * @param {Object} [opts] - override das janelas da superfície (teste): laterMinutes,
 *   upcomingMinutes, lateMinutes, nowBeforeMinutes, nowAfterMinutes
 * @returns {DoseActivityState|null} null = sem superfície
 */
export function deriveDoseActivityState(
  item: DoseActivityItemInput | null | undefined,
  now: Date | string = getRawNow(),
  opts: Partial<SurfaceWindows> = {}
): DoseActivityState | null {
  if (!item) return null

  const nowDate = resolveNow(now)
  const scheduledFor = pick<string | Date>(item, 'scheduledFor', 'scheduled_for')
  const isRegistered = item.isRegistered === true || item.status === 'taken'
  const toleranceMinutes = pick<number>(item, 'toleranceMinutes', 'tolerance_minutes')
  const ms = instantMs(scheduledFor)

  let state: DoseActivityStateValue
  if (isRegistered) {
    state = DOSE_ACTIVITY_STATES.DONE
  } else {
    if (ms === null) return null // instante inválido/ausente → sem superfície
    const diffMinutes = (ms - nowDate.getTime()) / 60000
    const w = { ...SURFACE_WINDOWS, ...opts }
    const resolved = resolveSurfaceState(diffMinutes, toleranceMinutes, w)
    if (resolved === null) return null // distante demais → sem superfície
    state = resolved
  }

  const remainingSeconds = ms === null ? null : Math.round((ms - nowDate.getTime()) / 1000)

  return {
    state,
    instanceId: pick<string>(item, 'instanceId', 'id'),
    treatmentId: pick<string>(item, 'treatmentPlanId', 'treatment_plan_id'),
    scheduledFor,
    remainingSeconds,
    isCritical: item.critical === true || item.critical_alarm === true,
    isRegistered,
    medicineLabel: item.medicineName ?? item.medicine?.name ?? 'Dose',
  }
}

/**
 * Timestamps absolutos (ms) das transições da superfície de UMA dose — base do agendamento
 * por trigger nativo (F2 trigger-driven): o card re-exibe o estado novo em cada boundary, mesmo
 * com o app fechado. Inclui o boundary do horário exato (`ms`, onde o countdown para → "agora"
 * estático). NÃO inclui o cap de cronômetro do `late` (presentation-only, vive no mobile).
 *
 * @param {string|Date} scheduledFor - instante agendado
 * @param {number|null} [toleranceMinutes] - tolerância da ocorrência (?? lateMinutes)
 * @param {Object} [opts] - override das janelas (mesmo de deriveDoseActivityState)
 * @returns {number[]} timestamps absolutos (ms) ordenados asc; [] se instante inválido
 */
export function doseActivityBoundaryTimes(
  scheduledFor: string | Date | null | undefined,
  toleranceMinutes: number | null = null,
  opts: Partial<SurfaceWindows> = {}
): number[] {
  const ms = instantMs(scheduledFor)
  if (ms === null) return []
  const w = { ...SURFACE_WINDOWS, ...opts }
  const tol = toleranceMinutes ?? w.lateMinutes
  const M = 60000
  return [
    ms - w.laterMinutes * M, // entra later (aparece)
    ms - w.upcomingMinutes * M, // later → upcoming (começa countdown)
    ms - w.nowBeforeMinutes * M, // upcoming → now
    ms, // horário: countdown para → "agora" estático
    ms + w.nowAfterMinutes * M, // now → late (count-up)
    ms + tol * M, // late → missed (encerra)
  ].sort((a, b) => a - b)
}

/**
 * Estados que disputam a superfície ativa (actionáveis). `done`/`missed` são
 * terminais — não competem (a superfície encerra ou nem aparece).
 * @private
 */
const ACTIONABLE: Set<DoseActivityStateValue> = new Set([
  DOSE_ACTIVITY_STATES.LATE,
  DOSE_ACTIVITY_STATES.NOW,
  DOSE_ACTIVITY_STATES.UPCOMING,
  DOSE_ACTIVITY_STATES.LATER,
])

/**
 * Rank de prioridade da superfície: `atrasada > crítica > now > próxima > distante` (FR-002).
 * Menor número = maior prioridade. Crítica eleva acima de now/upcoming/later, mas NÃO acima de
 * `late` (uma dose atrasada é o sinal mais urgente, crítica ou não).
 * @private
 */
function priorityRank(s: DoseActivityState): number {
  if (s.state === DOSE_ACTIVITY_STATES.LATE) return 0
  if (s.isCritical) return 1
  if (s.state === DOSE_ACTIVITY_STATES.NOW) return 2
  if (s.state === DOSE_ACTIVITY_STATES.UPCOMING) return 3
  return 4 // later
}

/**
 * Seleciona a ÚNICA superfície ativa entre N doses simultâneas, agrupando por
 * `treatment_plan` (espírito de R-191 / partitionDoses — nunca exibir superfícies
 * concorrentes). Implementação própria do agrupamento: `partitionDoses` vive no bot
 * (server-side, não importável do core); aqui só precisamos do vencedor + tamanho do
 * grupo do plano dele (p/ a superfície dizer "+N do mesmo tratamento").
 *
 * Critério: maior prioridade (`priorityRank`); empate → instante mais urgente
 * (menor `remainingSeconds` — mais atrasada/mais próxima primeiro).
 *
 * @param {Array} items - DoseItems (ou dose_instances cruas) do contexto actionável
 * @param {Date} [now=getRawNow()]
 * @param {Object} [opts] - repassado a deriveDoseActivityState
 * @returns {(DoseActivityState & {groupSize: number})|null} 1 superfície, ou null se vazio/sem actionável
 */
/**
 * `c` vence `winner`? Maior prioridade; empate → mais urgente (menor remainingSeconds;
 * null por último). @private
 */
function beats(c: DoseActivityState, winner: DoseActivityState): boolean {
  const dr = priorityRank(c) - priorityRank(winner)
  if (dr !== 0) return dr < 0
  const cr = c.remainingSeconds ?? Number.POSITIVE_INFINITY
  const wr = winner.remainingSeconds ?? Number.POSITIVE_INFINITY
  return cr < wr
}

export function selectActiveDoseActivity(
  items: DoseActivityItemInput[],
  now: Date | string = getRawNow(),
  opts: Partial<SurfaceWindows> = {}
): (DoseActivityState & { groupSize: number }) | null {
  if (!Array.isArray(items) || items.length === 0) return null

  const candidates: DoseActivityState[] = []
  for (const item of items) {
    const st = deriveDoseActivityState(item, now, opts)
    if (st && ACTIONABLE.has(st.state)) candidates.push(st)
  }
  if (candidates.length === 0) return null

  let winner = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    if (beats(candidates[i], winner)) winner = candidates[i]
  }

  // Tamanho do grupo do plano vencedor (doses actionáveis do mesmo treatment_plan).
  // treatmentId null = dose avulsa → grupo de 1 (não agrupa avulsas entre si).
  const groupSize =
    winner.treatmentId === null
      ? 1
      : candidates.filter((c) => c.treatmentId === winner.treatmentId).length

  return { ...winner, groupSize }
}
