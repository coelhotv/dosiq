// useTodayData.js — hook para dados da tela Hoje
// Padrão: { data, loading, error, stale, refresh }
// R-010: ordem de declaração — states → effects → handlers
// stale=true quando há snapshot em cache mas a última refresh falhou (R5-008)

import { useState, useEffect, useCallback } from 'react'
import { getTodayLocal } from '@meus-remedios/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import {
  getActiveProtocols,
  getTodayLogs,
  getMedicineNames,
} from '../services/dashboardService'

/**
 * @typedef {{ protocols: Array, logs: Array, medicineNames: Record<string,string> }} TodayData
 * @returns {{ data: TodayData|null, loading: boolean, error: string|null, stale: boolean, refresh: Function }}
 */
export function useTodayData() {
  // States primeiro (R-010)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('[useTodayData] getUser start')
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('[useTodayData] getUser result — user:', user?.id ?? 'null', 'authError:', authError?.message ?? 'none')
      if (authError || !user) throw new Error('Sessão expirada.')

      const today = getTodayLocal() // R-020: nunca new Date('YYYY-MM-DD')
      console.log('[useTodayData] today:', today)

      console.log('[useTodayData] getActiveProtocols start')
      let protocols, logs
      try {
        protocols = await getActiveProtocols(user.id)
        console.log('[useTodayData] protocols OK:', protocols.length)
      } catch (e) {
        console.error('[useTodayData] getActiveProtocols ERRO:', JSON.stringify(e))
        throw e
      }

      try {
        logs = await getTodayLogs(user.id, today)
        console.log('[useTodayData] logs OK:', logs.length)
      } catch (e) {
        console.error('[useTodayData] getTodayLogs ERRO:', JSON.stringify(e))
        throw e
      }

      // Enriquecer com nomes dos medicamentos
      const medicineIds = [...new Set(protocols.map((p) => p.medicine_id))]
      const medicineNames = await getMedicineNames(medicineIds)
      console.log('[useTodayData] medicineNames OK:', Object.keys(medicineNames).length)

      setData({ protocols, logs, medicineNames })
      setStale(false)
    } catch (err) {
      console.error('[useTodayData] ERRO FINAL:', err?.message, err?.code, err?.details, err?.hint)
      console.warn('[useTodayData] stale check — data snapshot presente:', data !== null)
      setError(err.message ?? 'Erro ao carregar dados do dia.')
      // Se há snapshot, marcar como stale em vez de apagar (R5-008)
      if (data !== null) setStale(true)
    } finally {
      setLoading(false)
    }
  }, [data]) // data na dep array para evitar stale closure ao verificar snapshot (R5-008)

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, stale, refresh: load }
}
