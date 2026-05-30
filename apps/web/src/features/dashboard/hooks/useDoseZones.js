/**
 * useDoseZones — Hook de classificação temporal de doses (W2-01)
 *
 * Organiza as doses do dia em zonas temporais deslizantes relativas ao horário
 * atual: ATRASADAS, AGORA, PRÓXIMAS, MAIS TARDE, REGISTRADAS. Recalcula a cada 60s.
 *
 * Fase 3 (F3.2b): consome `dose_instances` materializadas (status `pending`/`taken`/
 * `missed`) em vez de inferir slots ±2h sobre logs (R-248). Cada ocorrência carrega
 * `scheduled_for` ABSOLUTO (timestamptz) → a classificação usa o instante real, não
 * `setHours()` no dia local. Isso elimina o bug cross-meia-noite (dose de ontem 22:30
 * registrada às 00:05 não vira slot fantasma de hoje — ela é uma ocorrência de ontem,
 * fora da janela do dia atual).
 *
 * @module useDoseZones
 */

import { useState, useEffect, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { getRawNow, getUserTime, parseISO } from '@utils/dateUtils'

/** tz default (G1 — injeção real do tz do usuário fica para a Fase 4; default SP). */
const DEFAULT_TZ = 'America/Sao_Paulo'

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
  const local = getUserTime(parseISO(scheduledFor), tz)
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
  const byId = new Map((protocols || []).map((p) => [p.id, p]))

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
 * useDoseZones — Hook principal
 *
 * @param {Object} [options]
 * @param {number} [options.lateWindowMinutes=120]
 * @param {number} [options.nowWindowMinutes=60]
 * @param {number} [options.upcomingWindowMinutes=240]
 * @returns {{ zones, totals, isLoading, refresh, now }}
 */
export function useDoseZones({
  lateWindowMinutes = 120,
  nowWindowMinutes = 60,
  upcomingWindowMinutes = 240,
} = {}) {
  const { protocols, doseInstances, isLoading, refresh } = useDashboard()

  // Estado de "agora" — usa Date bruto para o timer (diff absoluto em classifyDose)
  const [nowRaw, setNowRaw] = useState(() => getRawNow())

  useEffect(() => {
    let intervalId = null

    const startInterval = () => {
      if (intervalId) return
      intervalId = setInterval(() => setNowRaw(getRawNow()), 60_000)
    }

    const stopInterval = () => {
      clearInterval(intervalId)
      intervalId = null
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval()
      } else {
        setNowRaw(getRawNow()) // atualizar imediatamente ao retornar
        startInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    startInterval()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopInterval()
    }
  }, [])

  // Construir DoseItems do dia a partir das ocorrências materializadas
  const allDoses = useMemo(
    () => buildDoseItemsFromInstances(doseInstances || [], protocols || []),
    [doseInstances, protocols]
  )

  // Classificar doses em zonas
  const zones = useMemo(() => {
    const result = { late: [], now: [], upcoming: [], later: [], done: [] }

    for (const dose of allDoses) {
      const zone = classifyDose(
        dose.scheduledFor,
        nowRaw,
        lateWindowMinutes,
        nowWindowMinutes,
        upcomingWindowMinutes,
        dose.isRegistered,
        dose.toleranceMinutes
      )
      if (zone !== null && result[zone]) {
        result[zone].push(dose)
      }
    }

    // Ordenar cada zona por instante agendado
    const sortByInstant = (a, b) => parseISO(a.scheduledFor) - parseISO(b.scheduledFor)
    Object.values(result).forEach((arr) => arr.sort(sortByInstant))

    return result
  }, [allDoses, nowRaw, lateWindowMinutes, nowWindowMinutes, upcomingWindowMinutes])

  // Totais
  const totals = useMemo(() => {
    const taken = zones.done.length
    const pending =
      zones.late.length + zones.now.length + zones.upcoming.length + zones.later.length
    const expected = taken + pending
    return { expected, taken, pending }
  }, [zones])

  // `now` shiftado (wall-clock SP) p/ exibição/agrupamento por hora; `nowRaw` absoluto
  // p/ classificação por instante (classifyDose vs scheduled_for absoluto).
  return { zones, totals, isLoading, refresh, now: getUserTime(nowRaw, DEFAULT_TZ), nowRaw }
}
