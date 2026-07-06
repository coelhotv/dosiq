import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import {
  getTodayLocal,
  computeAdherenceFromInstances,
  computeStreakFromInstances,
  parseISO,
} from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getHistoryTimeline } from '../services/historyTimelineService'

function shiftDateStr(dateStr, days) {
  // T12:00:00 evita UTC-midnight (R-020); parseISO do core no lugar de new Date()
  const d = parseISO(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const HISTORY_PAST_DAYS = 30
const HISTORY_FUTURE_DAYS = 7

export function useHistoryData() {
  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDay, setSelectedDay] = useState(getTodayLocal())
  const [timezone, setTimezone] = useState('America/Sao_Paulo')

  // ADR-054: KPIs usam apenas eventos de dose (nunca biomarkers)
  const doseItems = useMemo(() => allItems.filter(ev => ev.type === 'dose'), [allItems])
  const measureItems = useMemo(() => allItems.filter(ev => ev.type === 'biomarker'), [allItems])

  // Combinação para renderização (doses + medidas, ordenados pelo service)
  const instances = allItems

  const kpis = useMemo(() => {
    // Converte itens flat de volta ao shape mínimo que computeAdherenceFromInstances espera
    const adherenceData = computeAdherenceFromInstances(doseItems.map(ev => ({
      status: ev.status,
      scheduled_for: ev.scheduled_for,
    })))
    const adherence30d = Math.round(adherenceData.rate * 100)
    const streak = computeStreakFromInstances(doseItems.map(ev => ({
      status: ev.status,
      scheduled_for: ev.scheduled_for,
    })))

    const monthPrefix = getTodayLocal().slice(0, 7)
    // Conta taken de doses no mês corrente (ADR-054: biomarkers excluídos)
    const dosesThisMonth = doseItems.filter(ev => {
      if (ev.status !== 'taken') return false
      return ev.localDay?.startsWith(monthPrefix)
    }).length

    return { adherence30d, streak, dosesThisMonth }
  }, [doseItems])

  const today = getTodayLocal()
  const minDay = shiftDateStr(today, -(HISTORY_PAST_DAYS - 1))
  const maxDay = shiftDateStr(today, HISTORY_FUTURE_DAYS)

  // T007: usa localDay derivado pelo core (fuso correto, sem utcToLocalDateStr custom)
  const instancesForDay = useMemo(() => {
    return allItems.filter(ev => {
      if (ev.localDay !== selectedDay) return false
      if (ev.type === 'dose' && ev.status === 'skipped_paused') return false
      return true
    })
  }, [allItems, selectedDay])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const session = await supabase.auth.getSession()
      const userId = session?.data?.session?.user?.id
      if (!userId) {
        setError('Usuário não autenticado')
        return
      }

      // Carrega timezone antes do service para passar o fuso correto ao core
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('timezone')
        .eq('user_id', userId)
        .single()

      const tz = settingsData?.timezone || 'America/Sao_Paulo'
      startTransition(() => setTimezone(tz))

      const items = await getHistoryTimeline(userId, {
        pastDays: HISTORY_PAST_DAYS,
        futureDays: HISTORY_FUTURE_DAYS,
        tz,
      })

      setAllItems(items)
    } catch (err) {
      setError(err?.message || 'Erro ao carregar histórico')
      console.error('[useHistoryData] load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => { load() })
  }, [load])

  return {
    instances,
    loading,
    error,
    selectedDay,
    setSelectedDay,
    kpis,
    instancesForDay,
    timezone,
    minDay,
    maxDay,
    refresh: load,
    measureItems,
  }
}
