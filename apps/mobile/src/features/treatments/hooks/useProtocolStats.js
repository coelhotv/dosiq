// useProtocolStats.js — estatísticas de doses para warning de delete (Fase 2 §3.7).
// Padrão: { data, loading, error }
//
// API: useProtocolStats(protocol) — recebe o objeto protocol já carregado por
// outro hook (Detail tem useProtocol(id)) pra evitar fetch redundante só pra
// obter time_schedule.length. Aceita { id, time_schedule } no mínimo.
//
// v1 (Sprint T2.2): confirmedLast7d via query real; scheduledNext7d é
// estimativa ingênua baseada em time_schedule.length. Refinar quando util
// de adherenceLogic for adaptado para mobile.

import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getNow, addDays } from '@dosiq/core'
import { debugLog } from '@shared/utils/debugLog'

export function useProtocolStats(protocol) {
  // States
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const protocolId = protocol?.id ?? null
  const dailyDoses = Array.isArray(protocol?.time_schedule)
    ? protocol.time_schedule.length
    : 0

  // Handlers
  const load = useCallback(async () => {
    if (!protocolId) {
      setLoading(false)
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const today = getNow()
      const sevenDaysAgo = addDays(today, -7)

      const logsResult = await supabase
        .from('medicine_logs')
        .select('*', { count: 'exact', head: true })
        .eq('protocol_id', protocolId)
        .gte('taken_at', sevenDaysAgo.toISOString())
        .lte('taken_at', today.toISOString())

      if (logsResult.error) throw logsResult.error

      setData({
        confirmedLast7d: logsResult.count ?? 0,
        scheduledNext7d: dailyDoses * 7,
      })
    } catch (err) {
      if (__DEV__) debugLog('useProtocolStats', 'fetch failed:', err.message)
      setError(err.message ?? 'Erro ao carregar estatísticas.')
    } finally {
      setLoading(false)
    }
  }, [protocolId, dailyDoses])

  // Effects
  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [load])

  // Memos
  return useMemo(
    () => ({ data, loading, error }),
    [data, loading, error]
  )
}
