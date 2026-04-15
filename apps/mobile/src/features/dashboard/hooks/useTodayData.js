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

      // Injetar objeto medicine em cada protocolo para o calculateDosesByDate poder enriquecer as doses
      const enrichedProtocols = protocols.map(p => ({
        ...p,
        medicine: medicines[p.medicine_id] || null
      }))

      const newData = { protocols: enrichedProtocols, logs, medicines }
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
    
    // 1. Classificar doses em zonas para o Dashboard (Splitting)
    // Conforme Spec H5.7.5: late, now, upcoming, done
    const { takenDoses, missedDoses, scheduledDoses } = calculateDosesByDate(
      todayStr,
      data.logs,
      data.protocols
    )

    // 2. Calcular estatísticas de adesão (Hoje)
    // Para o Dashboard diário, garantimos que os números batam com a UI visível
    const stats = {
      expected: missedDoses.length + scheduledDoses.length + takenDoses.length,
      taken: takenDoses.length,
      score: 0
    }
    
    // Score diário simples: (tomadas / esperadas) * 100
    if (stats.expected > 0) {
      stats.score = (stats.taken / stats.expected) * 100
    }

    // 1.5 Ordenar listas cronologicamente (00:00 -> 23:59)
    const sortByTime = (a, b) => {
      const timeA = a.scheduledTime || (a.taken_at ? new Date(a.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00')
      const timeB = b.scheduledTime || (b.taken_at ? new Date(b.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00')
      return timeA.localeCompare(timeB)
    }

    const zones = {
      late: missedDoses.sort(sortByTime),
      now: scheduledDoses.filter(d => {
        const [h, m] = d.scheduledTime.split(':').map(Number)
        const scheduledDate = new Date()
        scheduledDate.setHours(h, m, 0, 0)
        const now = new Date()
        const diffHours = (now - scheduledDate) / (1000 * 60 * 60)
        return diffHours >= -0.5 && diffHours <= 2
      }).sort(sortByTime),
      upcoming: scheduledDoses.sort(sortByTime),
      done: takenDoses.sort(sortByTime)
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
