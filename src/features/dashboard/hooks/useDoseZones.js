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
import { parseLocalDate, getTodayLocal } from '@utils/dateUtils'

/**
 * Tipo DoseItem — Representa uma dose individual expandida de um protocolo.
 * @typedef {Object} DoseItem
 * @property {string} protocolId
 * @property {string} medicineId
 * @property {string} medicineName
 * @property {string} scheduledTime - "HH:MM"
 * @property {number} dosagePerIntake
 * @property {string|null} treatmentPlanId
 * @property {string|null} treatmentPlanName
 * @property {{ emoji: string, color: string }|null} planBadge
 * @property {boolean} isRegistered
 * @property {string|null} registeredAt - ISO timestamp
 */

/**
 * Verifica se uma dose foi registrada hoje, com tolerância de ±30 minutos.
 * @param {string} protocolId
 * @param {string} scheduledTime - "HH:MM"
 * @param {Array} todayLogs - logs filtrados para hoje
 * @returns {boolean}
 */
export function isDoseRegistered(protocolId, scheduledTime, todayLogs) {
  if (!todayLogs || todayLogs.length === 0) return false
  const [h, m] = scheduledTime.split(':').map(Number)
  const TOLERANCE_MS = 30 * 60 * 1000 // 30 minutos
  return todayLogs.some((log) => {
    if (log.protocol_id !== protocolId) return false
    const logDate = new Date(log.taken_at)
    const scheduled = new Date(logDate)
    scheduled.setHours(h, m, 0, 0)
    return Math.abs(logDate - scheduled) <= TOLERANCE_MS
  })
}

/**
 * Retorna o ISO timestamp do registro se encontrado, null caso contrário.
 * @param {string} protocolId
 * @param {string} scheduledTime
 * @param {Array} todayLogs
 * @returns {string|null}
 */
export function findRegistrationTime(protocolId, scheduledTime, todayLogs) {
  if (!todayLogs || todayLogs.length === 0) return null
  const [h, m] = scheduledTime.split(':').map(Number)
  const TOLERANCE_MS = 30 * 60 * 1000
  const log = todayLogs.find((l) => {
    if (l.protocol_id !== protocolId) return false
    const logDate = new Date(l.taken_at)
    const scheduled = new Date(logDate)
    scheduled.setHours(h, m, 0, 0)
    return Math.abs(logDate - scheduled) <= TOLERANCE_MS
  })
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
  const scheduled = new Date(now)
  scheduled.setHours(hours, minutes, 0, 0)

  const diffMs = scheduled.getTime() - now.getTime()
  const diffMinutes = diffMs / 60000

  if (diffMinutes < -lateWindowMinutes) return null // muito antiga — não mostrar
  if (diffMinutes < 0) return 'late' // atrasada (0 a -lateWindow)
  if (diffMinutes < nowWindowMinutes) return 'now' // agora
  if (diffMinutes < upcomingWindowMinutes) return 'upcoming' // próximas
  return 'later' // mais tarde
}

/**
 * Expande protocolos em DoseItems individuais (um por horário do time_schedule).
 * @param {Array} protocols
 * @param {Array} todayLogs
 * @returns {DoseItem[]}
 */
export function expandProtocolsToDoses(protocols, todayLogs) {
  const doses = []
  for (const protocol of protocols) {
    // Excluir protocolos "quando_necessario"
    if (protocol.frequency === 'quando_necessario') continue
    const times = protocol.time_schedule || []
    for (const time of times) {
      const registrationTime = findRegistrationTime(protocol.id, time, todayLogs)
      doses.push({
        protocolId: protocol.id,
        medicineId: protocol.medicine_id,
        medicineName: protocol.medicine?.name || 'Desconhecido',
        scheduledTime: time,
        dosagePerIntake: protocol.dosage_per_intake ?? 1,
        treatmentPlanId: protocol.treatment_plan_id || null,
        treatmentPlanName: protocol.treatment_plan?.name || null,
        planBadge: protocol.treatment_plan?.badge || null,
        isRegistered: !!registrationTime,
        registeredAt: registrationTime,
      })
    }
  }
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
    const logTime = new Date(log.taken_at).getTime()
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
 * @returns {{ zones, totals, isLoading, refresh }}
 */
export function useDoseZones({
  lateWindowMinutes = 120,
  nowWindowMinutes = 60,
  upcomingWindowMinutes = 240,
} = {}) {
  const { protocols, logs, isLoading, refresh } = useDashboard()

  // Estado de "agora" — recalcula a cada 60 segundos (pausado quando aba não está visível)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let intervalId = null

    const startInterval = () => {
      if (intervalId) return
      intervalId = setInterval(() => setNow(new Date()), 60_000)
    }

    const stopInterval = () => {
      clearInterval(intervalId)
      intervalId = null
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval()
      } else {
        setNow(new Date()) // atualizar imediatamente ao retornar
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
        now,
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
  }, [allDoses, now, lateWindowMinutes, nowWindowMinutes, upcomingWindowMinutes])

  // Totais
  const totals = useMemo(() => {
    const taken = zones.done.length
    const pending = zones.late.length + zones.now.length + zones.upcoming.length + zones.later.length
    const expected = taken + pending
    return { expected, taken, pending }
  }, [zones])

  return { zones, totals, isLoading, refresh }
}
