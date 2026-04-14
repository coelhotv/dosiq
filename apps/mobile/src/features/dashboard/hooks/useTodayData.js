// useTodayData.js — hook para dados da tela Hoje
// Padrão: { data, loading, error, stale, refresh }
// R-010: ordem de declaração — states → effects → handlers
// stale=true quando há snapshot em cache mas a última refresh falhou (R5-008)

import { useState, useEffect, useCallback, useRef } from 'react'
import { getTodayLocal } from '@meus-remedios/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import {
  getActiveProtocols,
  getTodayLogs,
  getMedicineNames,
} from '../services/dashboardService'

/**
 * @typedef {{ protocols: Array, logs: Array, medicines: Record<string,Object> }} TodayData
 * @returns {{ data: TodayData|null, loading: boolean, error: string|null, stale: boolean, refresh: Function }}
 */
export function useTodayData() {
  // States primeiro (R-010)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  // Ref para snapshot check sem entrar nos deps do useCallback (evita loop infinito)
  const dataRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (__DEV__) console.log('[useTodayData] getUser start')
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (__DEV__) console.log('[useTodayData] getUser result — user:', user?.id ?? 'null', 'authError:', authError?.message ?? 'none')
      if (authError || !user) throw new Error('Sessão expirada.')

      const today = getTodayLocal() // R-020: nunca new Date('YYYY-MM-DD')
      if (__DEV__) console.log('[useTodayData] today:', today)

      if (__DEV__) console.log('[useTodayData] getActiveProtocols start')
      let protocols, logs
      try {
        protocols = await getActiveProtocols(user.id)
        if (__DEV__) console.log('[useTodayData] protocols OK:', protocols.length)
      } catch (e) {
        if (__DEV__) console.error('[useTodayData] getActiveProtocols ERRO:', JSON.stringify(e))
        throw e
      }

      try {
        logs = await getTodayLogs(user.id, today)
        if (__DEV__) console.log('[useTodayData] logs OK:', logs.length)
      } catch (e) {
        if (__DEV__) console.error('[useTodayData] getTodayLogs ERRO:', JSON.stringify(e))
        throw e
      }

      // Enriquecer com nomes e dosagens dos medicamentos
      const medicineIds = [...new Set(protocols.map((p) => p.medicine_id))]
      const medicines = await getMedicinesData(medicineIds)
      if (__DEV__) console.log('[useTodayData] medicines OK:', Object.keys(medicines).length)

      const newData = { protocols, logs, medicines }
      dataRef.current = newData
      setData(newData)
      setStale(false)
    } catch (err) {
      if (__DEV__) console.error('[useTodayData] ERRO FINAL:', err?.message, err?.code, err?.details, err?.hint)
      if (__DEV__) console.warn('[useTodayData] stale check — data snapshot presente:', dataRef.current !== null)
      setError(err.message ?? 'Erro ao carregar dados do dia.')
      // Se há snapshot, marcar como stale em vez de apagar (R5-008)
      if (dataRef.current !== null) setStale(true)
    } finally {
      setLoading(false)
    }
  }, []) // deps vazio — dataRef.current não é estado, não causa re-render nem recria o callback

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, stale, refresh: load }
}
