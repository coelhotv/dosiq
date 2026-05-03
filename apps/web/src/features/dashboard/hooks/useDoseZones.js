/**
 * useDoseZones — Hook de classificação temporal de doses (W2-01)
 *
 * Organiza os protocolos ativos em zonas temporais deslizantes relativas ao
 * horário atual: ATRASADAS, AGORA, PRÓXIMAS, MAIS TARDE, REGISTRADAS.
 *
 * As zonas recalculam automaticamente a cada 60 segundos.
 *
 * @module useDoseZones
 */

import { useState, useEffect, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import {
  parseLocalDate,
  getRawNow,
  getTodayLocal,
  isProtocolActiveOnDate,
  getSaoPauloTime,
  parseISO,
  cloneDate,
} from '@utils/dateUtils'

/**
 * Tipo DoseItem — Representa uma dose individual expandida de um protocolo.
 * @typedef {Object} DoseItem
 * @property {string} protocolId
 * @property {string} medicineId
 * @property {string} medicineName
 * @property {string} medicineType - 'medicamento' | 'suplemento'
 * @property {string} scheduledTime - "HH:MM"
 * @property {number} dosagePerIntake
 * @property {string|null} treatmentPlanId
 * @property {string|null} treatmentPlanName
 * @property {{ emoji: string, color: string }|null} planBadge
 * @property {boolean} isRegistered
 * @property {string|null} registeredAt - ISO timestamp
 */

/**
 * Janela de tolerância para matching de dose registrada.
 * Deve ser idêntica a LATE_WINDOW_MINUTES em CronogramaPeriodo e lateWindowMinutes em classifyDose.
 * Regra: dose registrada dentro de ±120min do horário agendado conta como tomada.
 */
export const DOSE_REGISTRATION_TOLERANCE_MS = 120 * 60 * 1000 // 120 minutos

/**
 * Encontra o log correspondente a um horário agendado, com tolerância.
 * @private
 */
function getLogForSchedule(protocolId, scheduledTime, todayLogs) {
  if (!todayLogs || todayLogs.length === 0) return null
  const [h, m] = scheduledTime.split(':').map(Number)
  return todayLogs.find((log) => {
    if (log.protocol_id !== protocolId) return false
    const logDate = getSaoPauloTime(parseISO(log.taken_at))
    const scheduled = cloneDate(logDate)
    scheduled.setHours(h, m, 0, 0)
    return Math.abs(logDate.getTime() - scheduled.getTime()) <= DOSE_REGISTRATION_TOLERANCE_MS
  })
}

/**
 * Verifica se uma dose foi registrada hoje.
 */
export function isDoseRegistered(protocolId, scheduledTime, todayLogs) {
  return !!getLogForSchedule(protocolId, scheduledTime, todayLogs)
}

/**
 * Retorna o ISO timestamp do registro se encontrado.
 */
export function findRegistrationTime(protocolId, scheduledTime, todayLogs) {
  const log = getLogForSchedule(protocolId, scheduledTime, todayLogs)
  return log ? log.taken_at : null
}

/**
 * Classifica uma dose em uma zona temporal.
 * @param {string} scheduledTime - "HH:MM"
 * @param {Date} now
 * @param {number} lateWindowMinutes - default 120
 * @param {number} nowWindowMinutes - default 60
 * @param {number} upcomingWindowMinutes - default 240
 * @param {boolean} isRegistered
 * @returns {'done'|'late'|'now'|'upcoming'|'later'|null} null = muito antiga, não exibir
 */
export function classifyDose(
  scheduledTime,
  now,
  lateWindowMinutes = 120,
  nowWindowMinutes = 60,
  upcomingWindowMinutes = 240,
  isRegistered = false
) {
  if (isRegistered) return 'done'

  const [hours, minutes] = scheduledTime.split(':').map(Number)
  const nowSP = getSaoPauloTime(now)
  const scheduled = cloneDate(nowSP)
  scheduled.setHours(hours, minutes, 0, 0)

  const diffMs = scheduled.getTime() - nowSP.getTime()
  const diffMinutes = diffMs / 60000

  if (diffMinutes < -lateWindowMinutes) return null // muito antiga — não mostrar
  if (diffMinutes < 0) return 'late' // atrasada (0 a -lateWindow)
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
 * Cria um objeto DoseItem a partir de um protocolo e horário.
 * @private
 */
function createDoseItem(protocol, scheduledTime, registrationTime) {
  const medicine = protocol.medicine || {}
  return {
    protocolId: protocol.id,
    medicineId: protocol.medicine_id,
    medicineName: medicine.name || 'Desconhecido',
    medicineType: medicine.type || 'medicamento',
    dosagePerPill: medicine.dosage_per_pill ?? null,
    dosageUnit: medicine.dosage_unit ?? null,
    scheduledTime,
    dosagePerIntake: protocol.dosage_per_intake ?? 1,
    treatmentPlanId: protocol.treatment_plan_id || null,
    treatmentPlanName: protocol.treatment_plan?.name || null,
    planBadge: getPlanBadge(protocol.treatment_plan),
    isRegistered: !!registrationTime,
    registeredAt: registrationTime,
  }
}

/**
 * Expande protocolos em DoseItems individuais.
 */
export function expandProtocolsToDoses(protocols, todayLogs) {
  const doses = []
  const todayStr = getTodayLocal()

  protocols.forEach((protocol) => {
    // 1. Validar elegibilidade
    if (protocol.frequency === 'quando_necessario') return
    if (!isProtocolActiveOnDate(protocol, todayStr)) return

    // 2. Expandir horários
    const times = protocol.time_schedule || []
    times.forEach((time) => {
      const regTime = findRegistrationTime(protocol.id, time, todayLogs)
      doses.push(createDoseItem(protocol, time, regTime))
    })
  })

  return doses
}

/**
 * Filtra logs de hoje (mesma data local que getTodayLocal()).
 * @param {Array} logs
 * @returns {Array}
 */
export function filterTodayLogs(logs) {
  if (!logs || logs.length === 0) return []
  const todayStr = getTodayLocal()
  const todayDate = parseLocalDate(todayStr)
  const todayStart = todayDate.getTime()
  const todayEnd = todayStart + 24 * 60 * 60 * 1000

  return logs.filter((log) => {
    if (!log.taken_at) return false
    const logTime = getSaoPauloTime(parseISO(log.taken_at)).getTime()
    return logTime >= todayStart && logTime < todayEnd
  })
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
  const { protocols, logs, isLoading, refresh } = useDashboard()

  // Estado de "agora" — usa Date bruto para o timer (evita double-shift em classifyDose)
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

  // Filtrar logs de hoje
  const todayLogs = useMemo(() => filterTodayLogs(logs), [logs])

  // Expandir protocolos em doses individuais
  const allDoses = useMemo(
    () => expandProtocolsToDoses(protocols || [], todayLogs),
    [protocols, todayLogs]
  )

  // Classificar doses em zonas
  const zones = useMemo(() => {
    const result = { late: [], now: [], upcoming: [], later: [], done: [] }

    for (const dose of allDoses) {
      const zone = classifyDose(
        dose.scheduledTime,
        nowRaw,
        lateWindowMinutes,
        nowWindowMinutes,
        upcomingWindowMinutes,
        dose.isRegistered
      )
      if (zone !== null && result[zone]) {
        result[zone].push(dose)
      }
    }

    // Ordenar cada zona por scheduledTime
    const sortByTime = (a, b) => {
      const [ah, am] = a.scheduledTime.split(':').map(Number)
      const [bh, bm] = b.scheduledTime.split(':').map(Number)
      return ah * 60 + am - (bh * 60 + bm)
    }
    Object.values(result).forEach((arr) => arr.sort(sortByTime))

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

  return { zones, totals, isLoading, refresh, now: getSaoPauloTime(nowRaw) }
}
