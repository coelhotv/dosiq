import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import {
  getTodayLocal,
  computeAdherenceFromInstances,
  computeStreakFromInstances,
  parseISO,
} from '@dosiq/core'

function shiftDateStr(dateStr, days) {
  const d = parseISO(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
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
    .select('id, name, medicine_id, dosage_per_intake, intake_unit, medicine:medicines(name, dosage_per_pill, dosage_unit, units_per_ml), treatment_plan:treatment_plans(name)')
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
      intake_unit: p.intake_unit,
      dosage_per_pill: p.medicine?.dosage_per_pill,
      dosage_unit: p.medicine?.dosage_unit,
      units_per_ml: p.medicine?.units_per_ml,
      treatment_name: p.treatment_plan?.name,
      protocol_name: p.name,
    }
  })
}

async function fetchOrphanLogs(userId, fromIso, toIso) {
  const { data, error } = await supabase
    .from('medicine_logs')
    .select('id, protocol_id, medicine_id, taken_at, quantity_taken, notes')
    .eq('user_id', userId)
    .is('dose_instance_id', null)
    .gte('taken_at', fromIso)
    .lte('taken_at', toIso)
    .order('taken_at', { ascending: false })
  if (error || !data) return []
  return data
}

// Normaliza log avulso para o mesmo shape de dose_instance consumido por DoseHistoryList.
// scheduled_for = taken_at: permite que o filtro de dia e o sort funcionem sem mudança.
// dosage_per_intake = quantity_taken: exibe a quantidade real tomada (não a do protocolo).
function normalizeOrphanLog(log) {
  return {
    ...log,
    id: `log:${log.id}`,
    logId: log.id,
    source: 'log',
    scheduled_for: log.taken_at,
    status: 'taken',
    is_orphan: true,
    dosage_per_intake: log.quantity_taken,
  }
}

// Dias carregados para trás e para frente
const HISTORY_PAST_DAYS = 30
const HISTORY_FUTURE_DAYS = 7

export function useHistoryData() {
  // Separados para KPIs: aderência/streak usam só dose_instances (ADR-054)
  const [doseInstances, setDoseInstances] = useState([])
  const [orphanItems, setOrphanItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDay, setSelectedDay] = useState(getTodayLocal())
  // Timezone precisa estar antes dos memos que dependem dela
  const [timezone, setTimezone] = useState('America/Sao_Paulo')

  // Lista combinada para renderização (instances + logs avulsos)
  const instances = useMemo(() => [...doseInstances, ...orphanItems], [doseInstances, orphanItems])

  const kpis = useMemo(() => {
    // Aderência e streak: dose_instances apenas (ADR-054 / AP-193)
    const adherenceData = computeAdherenceFromInstances(doseInstances)
    const adherence30d = Math.round(adherenceData.rate * 100)
    const streak = computeStreakFromInstances(doseInstances)

    const now = getTodayLocal()
    const monthPrefix = now.slice(0, 7) // "YYYY-MM"
    // Conta taken de instâncias + avulsas no mês
    const dosesThisMonth = instances.filter(item => {
      if (item.status !== 'taken') return false
      return utcToLocalDateStr(item.scheduled_for, timezone).startsWith(monthPrefix)
    }).length

    return { adherence30d, streak, dosesThisMonth }
  }, [doseInstances, instances, timezone])

  // Limites de navegação derivados da janela carregada
  const today = getTodayLocal()
  const minDay = shiftDateStr(today, -(HISTORY_PAST_DAYS - 1))
  const maxDay = shiftDateStr(today, HISTORY_FUTURE_DAYS)

  const instancesForDay = useMemo(() => {
    return instances
      .filter(item => item.status !== 'skipped_paused')
      .filter(item => utcToLocalDateStr(item.scheduled_for, timezone) === selectedDay)
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

      // Janela para busca de logs avulsos (mesma lógica dos dose_instances)
      const fromIso = shiftDateStr(getTodayLocal(), -HISTORY_PAST_DAYS) + 'T00:00:00Z'
      const toIso = shiftDateStr(getTodayLocal(), HISTORY_FUTURE_DAYS) + 'T23:59:59Z'

      const [raw, rawOrphanLogs, settings] = await Promise.all([
        getDoseInstancesForPeriod(userId, HISTORY_PAST_DAYS, HISTORY_FUTURE_DAYS),
        fetchOrphanLogs(userId, fromIso, toIso),
        supabase.from('user_settings').select('timezone').eq('user_id', userId).single(),
      ])

      if (settings?.data?.timezone) {
        startTransition(() => setTimezone(settings.data.timezone))
      }

      const [enrichedInstances, enrichedOrphan] = await Promise.all([
        enrichInstancesWithProtocol(raw || []),
        enrichInstancesWithProtocol(rawOrphanLogs),
      ])

      setDoseInstances(enrichedInstances)
      setOrphanItems(enrichedOrphan.map(normalizeOrphanLog))
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
    minDay,
    maxDay,
    refresh: load,
  }
}
