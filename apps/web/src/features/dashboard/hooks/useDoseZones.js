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
import { getRawNow, getUserTime } from '@utils/dateUtils'
// F4.3a (CON-024): lógica pura de zonas extraída para o core (R-231, sem duplicata).
// Re-exportada aqui para os consumidores web existentes (CronogramaDoseItem, Dashboard).
import { DEFAULT_TZ, classifyDose, buildDoseItemsFromInstances } from '@dosiq/core'

export { classifyDose, buildDoseItemsFromInstances }

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
    // scheduled_for é ISO 8601 → ordenável lexicograficamente (sem parse por comparação).
    const sortByInstant = (a, b) => a.scheduledFor.localeCompare(b.scheduledFor)
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
