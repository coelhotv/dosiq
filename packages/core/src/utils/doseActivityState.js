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

import { getRawNow, parseISO } from './dateUtils.js'
import { classifyDose } from './doseZones.js'

/**
 * Estados da superfície de dose (derivados, efêmeros). Subconjunto estável que as
 * superfícies nativas conhecem — NÃO é o enum de status do DB (`pending`/`taken`/...).
 * @readonly
 */
export const DOSE_ACTIVITY_STATES = Object.freeze({
  UPCOMING: 'upcoming', // próxima (inclui "mais tarde") — countdown regressivo
  NOW: 'now', // hora da dose — janela de ação
  LATE: 'late', // atrasada, dentro da tolerância — count-up
  DONE: 'done', // registrada — superfície encerra (cancel-on-resolve)
  MISSED: 'missed', // passou da tolerância sem registro — terminal
})

/**
 * Mapa zona temporal (`classifyDose`) → estado da superfície.
 * `later` colapsa em `upcoming`: a superfície não distingue "próxima" de "mais tarde"
 * (ambas são countdown regressivo); a granularidade extra de `classifyDose` é para a
 * timeline do "hoje", não para a superfície de 1 dose.
 * @private
 */
const ZONE_TO_STATE = Object.freeze({
  done: DOSE_ACTIVITY_STATES.DONE,
  late: DOSE_ACTIVITY_STATES.LATE,
  now: DOSE_ACTIVITY_STATES.NOW,
  upcoming: DOSE_ACTIVITY_STATES.UPCOMING,
  later: DOSE_ACTIVITY_STATES.UPCOMING,
})

/**
 * Tipo DoseActivityState — estado efêmero de uma dose para a superfície contínua.
 * @typedef {Object} DoseActivityState
 * @property {'upcoming'|'now'|'late'|'done'|'missed'} state
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
function pick(item, camel, snake) {
  return item[camel] ?? item[snake] ?? null
}

/** Instante é válido se presente e parseável. @private */
function instantMs(scheduledFor) {
  if (!scheduledFor) return null
  const ms = scheduledFor instanceof Date ? scheduledFor.getTime() : parseISO(scheduledFor).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Deriva o `DoseActivityState` de uma dose (DoseItem ou dose_instance crua).
 *
 * Distingue os dois `null` de `classifyDose`:
 * - instante ausente/inválido → `null` (sem superfície — não há o que mostrar).
 * - instante válido porém além da tolerância → `'missed'` (terminal, superfície honesta).
 *
 * Dose registrada → `'done'` direto (via `classifyDose(isRegistered=true)`).
 *
 * @param {Object|null} item - DoseItem ({instanceId, scheduledFor, ...}) ou dose_instance crua
 * @param {Date} [now=getRawNow()] - "agora" injetável; NULL/Invalid → getRawNow() (R-020)
 * @param {Object} [opts] - janelas de classifyDose (override de teste)
 * @param {number} [opts.lateWindowMinutes]
 * @param {number} [opts.nowWindowMinutes]
 * @param {number} [opts.upcomingWindowMinutes]
 * @returns {DoseActivityState|null} null = sem superfície
 */
export function deriveDoseActivityState(item, now = getRawNow(), opts = {}) {
  if (!item) return null

  const nowDate = now instanceof Date && !Number.isNaN(now.getTime()) ? now : getRawNow()
  const scheduledFor = pick(item, 'scheduledFor', 'scheduled_for')
  const isRegistered = item.isRegistered === true || item.status === 'taken'
  const toleranceMinutes = pick(item, 'toleranceMinutes', 'tolerance_minutes')

  const zone = classifyDose(
    scheduledFor,
    nowDate,
    opts.lateWindowMinutes,
    opts.nowWindowMinutes,
    opts.upcomingWindowMinutes,
    isRegistered,
    toleranceMinutes
  )

  let state
  if (zone === null) {
    // instante inválido/ausente → sem superfície; instante válido → passou tolerância → missed
    if (instantMs(scheduledFor) === null) return null
    state = DOSE_ACTIVITY_STATES.MISSED
  } else {
    state = ZONE_TO_STATE[zone]
  }

  const ms = instantMs(scheduledFor)
  const remainingSeconds = ms === null ? null : Math.round((ms - nowDate.getTime()) / 1000)

  return {
    state,
    instanceId: pick(item, 'instanceId', 'id'),
    treatmentId: pick(item, 'treatmentPlanId', 'treatment_plan_id'),
    scheduledFor,
    remainingSeconds,
    isCritical: item.critical === true || item.critical_alarm === true,
    isRegistered,
    medicineLabel: item.medicineName ?? item.medicine?.name ?? 'Dose',
  }
}

/**
 * Estados que disputam a superfície ativa (actionáveis). `done`/`missed` são
 * terminais — não competem (a superfície encerra ou nem aparece).
 * @private
 */
const ACTIONABLE = new Set([
  DOSE_ACTIVITY_STATES.LATE,
  DOSE_ACTIVITY_STATES.NOW,
  DOSE_ACTIVITY_STATES.UPCOMING,
])

/**
 * Rank de prioridade da superfície: `atrasada > crítica > now > próxima` (FR-002).
 * Menor número = maior prioridade. Crítica eleva `now`/`upcoming` acima de `now` comum,
 * mas NÃO acima de `late` (uma dose atrasada é o sinal mais urgente, crítica ou não).
 * @private
 */
function priorityRank(s) {
  if (s.state === DOSE_ACTIVITY_STATES.LATE) return 0
  if (s.isCritical) return 1
  if (s.state === DOSE_ACTIVITY_STATES.NOW) return 2
  return 3 // upcoming
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
export function selectActiveDoseActivity(items, now = getRawNow(), opts = {}) {
  if (!Array.isArray(items) || items.length === 0) return null

  const candidates = []
  for (const item of items) {
    const st = deriveDoseActivityState(item, now, opts)
    if (st && ACTIONABLE.has(st.state)) candidates.push(st)
  }
  if (candidates.length === 0) return null

  let winner = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]
    const dr = priorityRank(c) - priorityRank(winner)
    if (dr < 0) {
      winner = c
    } else if (dr === 0) {
      // empate de prioridade → mais urgente (menor remainingSeconds; null vai por último)
      const cr = c.remainingSeconds ?? Number.POSITIVE_INFINITY
      const wr = winner.remainingSeconds ?? Number.POSITIVE_INFINITY
      if (cr < wr) winner = c
    }
  }

  // Tamanho do grupo do plano vencedor (doses actionáveis do mesmo treatment_plan).
  // treatmentId null = dose avulsa → grupo de 1 (não agrupa avulsas entre si).
  const groupSize =
    winner.treatmentId === null
      ? 1
      : candidates.filter((c) => c.treatmentId === winner.treatmentId).length

  return { ...winner, groupSize }
}
