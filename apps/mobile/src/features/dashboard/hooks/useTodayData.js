// useTodayData.js — hook para dados da tela Hoje
// Padrão: { data, loading, error, stale, refresh }
// R-010: ordem de declaração — states → effects → handlers
// stale=true quando há snapshot em cache mas a última refresh falhou (R5-008)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getTodayLocal } from '@meus-remedios/core'
import { calculateAdherenceStats, calculateDosesByDate } from '@meus-remedios/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import {
  getActiveProtocols,
  getTodayLogs,
  getMedicinesData,
} from '../services/dashboardService'

/**
 * @typedef {{ 
 *   protocols: Array, 
 *   logs: Array, 
 *   medicines: Record<string,Object>,
 *   stats: Object,
 *   zones: Object 
 * }} TodayData
 * @returns {{ data: TodayData|null, loading: boolean, error: string|null, stale: boolean, refresh: Function }}
 */
export function useTodayData() {
  // States primeiro (R-010)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  // Ref para snapshot check sem entrar nos deps do useCallback
  const dataRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (__DEV__) console.log('[useTodayData] session check start')
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      let user = currentSession?.user
      if (sessionError || !user) {
        if (__DEV__) console.warn('[useTodayData] getSession failed or null, trying getUser as fallback')
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !verifiedUser) {
          throw new Error('Sessão expirada ou inválida.')
        }
        user = verifiedUser
      }

      if (__DEV__) console.log('[useTodayData] auth OK — user:', user.id)

      const today = getTodayLocal() // R-020: nunca new Date('YYYY-MM-DD')
      
      // Carregar dados brutos em paralelo
      const [protocols, logs] = await Promise.all([
        getActiveProtocols(user.id),
        getTodayLogs(user.id, today)
      ])

      // Enriquecer com nomes e dosagens dos medicamentos
      const medicineIds = [...new Set(protocols.map((p) => p.medicine_id))]
      const medicines = await getMedicinesData(medicineIds)

      const newData = { protocols, logs, medicines }
      dataRef.current = newData
      setData(newData)
      setStale(false)
    } catch (err) {
      if (__DEV__) console.error('[useTodayData] ERRO FINAL:', err?.message)
      setError(err.message ?? 'Erro ao carregar dados do dia.')
      if (dataRef.current !== null) setStale(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Derivar estatísticas e zonas (Performance: memoized)
  const enhancedData = useMemo(() => {
    if (!data) return null

    const todayStr = getTodayLocal()
    
    // 1. Calcular estatísticas de adesão (Hoje)
    // Usamos a lógica canônica do core para garantir paridade total
    const stats = calculateAdherenceStats(data.logs, data.protocols, 1)

    // 2. Classificar doses em zonas para o Dashboard (Splitting)
    // Conforme Spec H5.7.5: late, now, upcoming, done
    const { takenDoses, missedDoses, scheduledDoses } = calculateDosesByDate(
      todayStr,
      data.logs,
      data.protocols
    )

    // PAC (Priority Action Card) foca nas doses agendadas próximas ou atrasadas
    // No mobile, simplificamos as zonas para a UI:
    const zones = {
      late: missedDoses,      // Atrasadas hoje
      now: scheduledDoses.filter(d => {
        // Agora: Doses cuja janela de tolerância de 2h ainda inclui o momento atual
        const [h, m] = d.scheduledTime.split(':').map(Number)
        const scheduledDate = new Date()
        scheduledDate.setHours(h, m, 0, 0)
        const now = new Date()
        const diffHours = (now - scheduledDate) / (1000 * 60 * 60)
        return diffHours >= -0.5 && diffHours <= 2 // 30min antes até 2h depois
      }),
      upcoming: scheduledDoses,
      done: takenDoses
    }

    // 3. Calcular alertas de estoque
    const stockAlerts = Object.values(data.medicines || {})
      .filter(m => {
        const daysRemaining = m.daysRemaining ?? Infinity
        return daysRemaining <= 7 // Limiar para alerta no Dashboard
      })
      .map(m => ({
        medicineId: m.id,
        medicineName: m.name,
        daysRemaining: m.daysRemaining
      }))

    return {
      ...data,
      stats,
      zones,
      stockAlerts
    }
  }, [data])

  return { 
    data: enhancedData, 
    loading, 
    error, 
    stale, 
    refresh: load 
  }
}
