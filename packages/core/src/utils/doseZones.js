/**
 * doseZones — Lógica pura de classificação temporal de doses (Fase 4 / F4.3a)
 *
 * Núcleo compartilhado web↔mobile (R-231, constituição V): classifica ocorrências
 * `dose_instances` em zonas temporais deslizantes (ATRASADA/AGORA/PRÓXIMA/MAIS TARDE/
 * REGISTRADA) e constrói os DoseItems do dia a partir das instâncias materializadas.
 *
 * Fase 3 (F3.2b): consome `dose_instances` (status `pending`/`taken`/`missed`) em vez
 * de inferir slots ±2h sobre logs (R-248). Cada ocorrência carrega `scheduled_for`
 * ABSOLUTO (timestamptz) → a classificação usa o instante real, não `setHours()` no dia
 * local. Elimina o bug cross-meia-noite (dose de ontem 22:30 registrada às 00:05 não vira
 * slot fantasma de hoje — é ocorrência de ontem, fora da janela do dia atual).
 *
 * Puro: sem APIs do navegador, env vars ou estado global. `tz` injetável (default SP).
 * CON-024.
 *
 * @module doseZones
 */

import {
  getUserTime,
  parseISO,
  formatLocalDate,
  getStartOfDayISO,
  getEndOfDayISO,
  getRawNow,
} from './dateUtils.js'

/** tz default (G1 — injeção real do tz do usuário é follow-up; default SP). */
export const DEFAULT_TZ = 'America/Sao_Paulo'

/** Status que representam dose efetivamente tomada (zona "done"). */
const TAKEN_STATUS = 'taken'
/** Status que não devem aparecer no "hoje" (pulados não são pendência). */
const SKIPPED_STATUS = new Set(['skipped_paused', 'skipped_user'])

/**
 * Tipo DoseItem — Representa uma ocorrência de dose do dia.
 * @typedef {Object} DoseItem
 * @property {string} instanceId - id da dose_instance (âncora direta p/ registro)
 * @property {string} protocolId
 * @property {string} medicineId
 * @property {string} medicineName
 * @property {string} medicineType
 * @property {string} scheduledTime - "HH:MM" local (derivado de scheduled_for)
 * @property {string} scheduledFor - ISO absoluto (timestamptz da ocorrência)
 * @property {string} status - 'pending' | 'taken' | 'missed'
 * @property {number} dosagePerIntake
 * @property {string|null} treatmentPlanId
 * @property {string|null} treatmentPlanName
 * @property {{ emoji: string, color: string }|null} planBadge
 * @property {boolean} isRegistered
 * @property {string|null} registeredAt - ISO timestamp (scheduled_for quando taken)
 */

/**
 * Classifica uma dose em uma zona temporal a partir do seu instante ABSOLUTO.
 *
 * @param {string|Date} scheduledFor - instante agendado (ISO timestamptz ou Date)
 * @param {Date} now - "agora" bruto (getRawNow)
 * @param {number} lateWindowMinutes - default 120
 * @param {number} nowWindowMinutes - default 60
 * @param {number} upcomingWindowMinutes - default 240
 * @param {boolean} isRegistered
 * @param {number|null} toleranceMinutes - tolerância dinâmica da ocorrência
 *   (`dose_instances.tolerance_minutes`, ex: metade do gap entre doses adjacentes).
 *   Define o cutoff de atraso: depois de `scheduled_for + tolerance` a dose é `missed`
 *   (sai do actionável), espelhando o sweep `markMissedDueInstances`. Sem valor → usa
 *   `lateWindowMinutes` (120). NÃO usar 120 fixo: doses próximas (gap < 4h) têm tolerância
 *   menor, senão duas doses adjacentes ficam actionáveis ao mesmo tempo.
 * @returns {'done'|'late'|'now'|'upcoming'|'later'|null} null = fora da janela, não exibir
 */
export function classifyDose(
  scheduledFor,
  now,
  lateWindowMinutes = 120,
  nowWindowMinutes = 60,
  upcomingWindowMinutes = 240,
  isRegistered = false,
  toleranceMinutes = null
) {
  if (isRegistered) return 'done'
  if (!scheduledFor) return null // guard: null/undefined não chega ao parseISO

  const scheduledMs =
    scheduledFor instanceof Date ? scheduledFor.getTime() : parseISO(scheduledFor).getTime()
  if (Number.isNaN(scheduledMs)) return null

  const diffMinutes = (scheduledMs - now.getTime()) / 60000
  // Cutoff de atraso = tolerância da própria ocorrência (não 120 fixo).
  const lateCutoff = toleranceMinutes ?? lateWindowMinutes

  if (diffMinutes < -lateCutoff) return null // passou da tolerância → missed, não exibir
  if (diffMinutes < 0) return 'late' // atrasada, ainda dentro da tolerância
  if (diffMinutes < nowWindowMinutes) return 'now' // agora
  if (diffMinutes < upcomingWindowMinutes) return 'upcoming' // próximas
  return 'later' // mais tarde
}

/**
 * Cria o badge do plano de tratamento.
 * @private
 */
function getPlanBadge(plan) {
  if (!plan) return null
  return {
    emoji: plan.emoji || '📋',
    color: plan.color || '#6366f1',
  }
}

/**
 * Formata "HH:MM" local a partir de um instante absoluto, no tz informado.
 * @private
 */
function toLocalHHMM(scheduledFor, tz) {
  const parsed = parseISO(scheduledFor)
  // Date inválido → fallback amigável (getUserTime/Intl estoura em Invalid Date).
  if (Number.isNaN(parsed.getTime())) return '--:--'
  const local = getUserTime(parsed, tz)
  const h = String(local.getHours()).padStart(2, '0')
  const m = String(local.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Cria um DoseItem a partir de uma dose_instance e do protocolo correspondente.
 * @private
 */
function createDoseItem(instance, protocol, tz) {
  const medicine = protocol.medicine || {}
  const isRegistered = instance.status === TAKEN_STATUS
  return {
    instanceId: instance.id,
    protocolId: instance.protocol_id,
    medicineId: protocol.medicine_id,
    medicineName: medicine.name || 'Desconhecido',
    medicineType: medicine.type || 'medicamento',
    dosagePerPill: medicine.dosage_per_pill ?? null,
    dosageUnit: medicine.dosage_unit ?? null,
    scheduledTime: toLocalHHMM(instance.scheduled_for, tz),
    scheduledFor: instance.scheduled_for,
    toleranceMinutes: instance.tolerance_minutes ?? null,
    status: instance.status,
    dosagePerIntake: instance.expected_dose ?? protocol.dosage_per_intake ?? 1,
    treatmentPlanId: protocol.treatment_plan_id || null,
    treatmentPlanName: protocol.treatment_plan?.name || null,
    planBadge: getPlanBadge(protocol.treatment_plan),
    isRegistered,
    registeredAt: isRegistered ? instance.scheduled_for : null,
    critical: instance.critical_alarm === true,
    snoozedUntil: instance.snoozed_until ?? null,
  }
}

/**
 * Constrói os DoseItems do dia a partir das ocorrências materializadas.
 * Junta cada instância com o protocolo (metadata: medicamento, plano) já em contexto.
 * Pula ocorrências `skipped_*` (não são pendência) e sem protocolo correspondente.
 *
 * @param {Array} instances - dose_instances do dia (já restritas à janela)
 * @param {Array} protocols - protocolos do contexto (com .medicine / .treatment_plan)
 * @param {string} [tz=DEFAULT_TZ]
 * @returns {DoseItem[]}
 */
export function buildDoseItemsFromInstances(instances, protocols, tz = DEFAULT_TZ) {
  if (!Array.isArray(instances) || instances.length === 0) return []
  const protocolsList = Array.isArray(protocols) ? protocols : []
  const byId = new Map(protocolsList.filter(Boolean).map((p) => [p.id, p]))

  const doses = []
  for (const inst of instances) {
    if (!inst?.scheduled_for || SKIPPED_STATUS.has(inst.status)) continue
    const protocol = byId.get(inst.protocol_id)
    if (!protocol) continue
    doses.push(createDoseItem(inst, protocol, tz))
  }
  return doses
}

/**
 * Particiona ocorrências do contexto em `{ carryOver, today, lookAhead }` (F4.3e).
 *
 * Janela ACTIONÁVEL deslizante cross-dia, SIMÉTRICA em torno de `now` pela tolerância
 * dinâmica de cada ocorrência (`tolerance_minutes`, default 120):
 *
 * - **today**: `scheduled_for` na janela do dia local atual (day-bound — comportamento
 *   F3.2b/F4.3b inalterado; é o cronograma/períodos do dia).
 * - **carryOver** ("Pendências de ontem"): ocorrências de dia(s) local(is) ANTERIOR(es),
 *   `status === 'pending'`, ainda dentro da tolerância PARA TRÁS (`diff ≥ -tolerância`) —
 *   atrasadas mas ainda registráveis.
 * - **lookAhead** ("Em breve"): ocorrências do(s) próximo(s) dia(s) local(is),
 *   `status === 'pending'`, já dentro da tolerância PARA FRENTE (`diff ≤ +tolerância`) —
 *   chegando (ex.: às 23:30 a dose de amanhã 00:30 aparece). Espelha o carryOver.
 *
 * Doses de outro dia já `taken`/`missed` ou fora da tolerância NÃO entram (não são
 * actionáveis → ruído). carryOver/lookAhead são seções PRÓPRIAS, nunca slots de hoje
 * (preserva o fix do slot-fantasma cross-meia-noite).
 *
 * Helper PURO e tz-injetável: deriva o "hoje" do `now` injetado (não usa `new Date()`),
 * compartilhado web↔mobile (R-231 — sem duplicar fronteiras de dia). CON-024 aditivo.
 *
 * @param {Array} instances - dose_instances do contexto (janela cobrindo ontem+hoje+amanhã)
 * @param {Array} protocols - protocolos do contexto (com .medicine / .treatment_plan)
 * @param {{ now: Date, tz?: string }} opts
 * @returns {{ carryOver: DoseItem[], today: DoseItem[], lookAhead: DoseItem[] }}
 */
function classifyInstanceDay(inst, dayStart, dayEnd, nowMs) {
  if (!inst?.scheduled_for) return null
  const t = parseISO(inst.scheduled_for).getTime()
  if (Number.isNaN(t)) return null
  if (t >= dayStart && t <= dayEnd) {
    return 'today'
  }
  if (inst.status !== 'pending') return null
  const tol = inst.tolerance_minutes ?? 120
  const diffMin = (t - nowMs) / 60000
  if (t < dayStart && diffMin >= -tol) {
    return 'carry'
  }
  if (t > dayEnd && diffMin <= tol) {
    return 'ahead'
  }
  return null
}

export function splitDayTimeline(instances, protocols, { now, tz = DEFAULT_TZ } = {}) {
  const list = Array.isArray(instances) ? instances : []
  // `now` ausente/inválido → fallback p/ getRawNow (respeita offset dev) + guard NaN:
  // getUserTime usa Intl e estoura RangeError em Invalid Date (AP-194/PR #623).
  const nowDate = now instanceof Date ? now : now ? parseISO(now) : getRawNow()
  if (Number.isNaN(nowDate.getTime())) return { carryOver: [], today: [], lookAhead: [] }
  const nowMs = nowDate.getTime()
  const todayStr = formatLocalDate(getUserTime(nowDate, tz))
  const dayStart = parseISO(getStartOfDayISO(todayStr, tz)).getTime()
  const dayEnd = parseISO(getEndOfDayISO(todayStr, tz)).getTime()

  const carry = []
  const today = []
  const ahead = []
  for (const inst of list) {
    const category = classifyInstanceDay(inst, dayStart, dayEnd, nowMs)
    if (category === 'today') {
      today.push(inst)
    } else if (category === 'carry') {
      carry.push(inst)
    } else if (category === 'ahead') {
      ahead.push(inst)
    }
  }
  return {
    carryOver: buildDoseItemsFromInstances(carry, protocols, tz),
    today: buildDoseItemsFromInstances(today, protocols, tz),
    lookAhead: buildDoseItemsFromInstances(ahead, protocols, tz),
  }
}
