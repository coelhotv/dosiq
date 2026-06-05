import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import {
  getTodayLocal,
  computeAdherenceFromInstances,
  computeStreakFromInstances,
  parseISO,
} from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getDoseInstancesForPeriod } from '../../dashboard/services/dashboardService'

// Converte timestamp UTC para data local "YYYY-MM-DD" no tz do usuário.
// Evita o bug de doses das 22h local (= T01:00Z no dia seguinte) aparecerem no dia errado.
function utcToLocalDateStr(utcIso, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parseISO(utcIso))
  } catch {
    // fallback: corta o ISO diretamente (device tz)
    return utcIso.slice(0, 10)
  }
}

async function enrichInstancesWithProtocol(instances) {
  if (!instances.length) return instances

  const protocolIds = [...new Set(instances.map(i => i.protocol_id).filter(Boolean))]
  if (!protocolIds.length) return instances

  const { data, error } = await supabase
    .from('protocols')
    .select('id, name, medicine_id, dosage_per_intake, medicine:medicines(name, dosage_per_pill, dosage_unit), treatment_plan:treatment_plans(name)')
    .in('id', protocolIds)

  if (error || !data) return instances

  const byId = {}
  data.forEach(p => { byId[p.id] = p })

  return instances.map(inst => {
    const p = byId[inst.protocol_id]
    if (!p) return inst
    return {
      ...inst,
      medicine_id: p.medicine_id,
      medicine_name: p.medicine?.name ?? p.name,
      dosage_per_intake: p.dosage_per_intake,
      dosage_per_pill: p.medicine?.dosage_per_pill,
      dosage_unit: p.medicine?.dosage_unit,
      treatment_name: p.treatment_plan?.name,
      protocol_name: p.name,
    }
  })
}

export function useHistoryData() {
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDay, setSelectedDay] = useState(getTodayLocal())
  // Timezone precisa estar antes dos memos que dependem dela
  const [timezone, setTimezone] = useState('America/Sao_Paulo')

  const kpis = useMemo(() => {
    const adherenceData = computeAdherenceFromInstances(instances)
    const adherence30d = Math.round(adherenceData.rate * 100)
    const streak = computeStreakFromInstances(instances)

    const now = getTodayLocal()
    const monthPrefix = now.slice(0, 7) // "YYYY-MM"
    const dosesThisMonth = instances.filter(inst => {
      if (inst.status !== 'taken') return false
      // Comparar data local do scheduled_for com o mês corrente
      return utcToLocalDateStr(inst.scheduled_for, timezone).startsWith(monthPrefix)
    }).length

    return { adherence30d, streak, dosesThisMonth }
  }, [instances, timezone])

  const instancesForDay = useMemo(() => {
    return instances.filter(inst =>
      utcToLocalDateStr(inst.scheduled_for, timezone) === selectedDay
    )
  }, [instances, selectedDay, timezone])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const session = await supabase.auth.getSession()
      if (!session?.data?.session?.user?.id) {
        setError('Usuário não autenticado')
        return
      }

      const userId = session.data.session.user.id

      const [raw, settings] = await Promise.all([
        getDoseInstancesForPeriod(userId, 30),
        supabase.from('user_settings').select('timezone').eq('user_id', userId).single(),
      ])

      if (settings?.data?.timezone) {
        startTransition(() => setTimezone(settings.data.timezone))
      }

      const data = await enrichInstancesWithProtocol(raw || [])
      setInstances(data)
    } catch (err) {
      setError(err?.message || 'Erro ao carregar histórico')
      console.error('[useHistoryData] load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      load()
    })
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
    refresh: load,
  }
}
