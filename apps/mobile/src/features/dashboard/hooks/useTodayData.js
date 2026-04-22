// useTodayData.js — hook para dados da tela Hoje
// Padrão: { data, loading, error, stale, refresh }
// R-010: ordem de declaração — states → effects → handlers
// stale=true quando há snapshot em cache mas a última refresh falhou (R5-008)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTodayLocal, parseLocalDate, evaluateDoseTimelineState, isProtocolActiveOnDate } from '@dosiq/core'
import { calculateAdherenceStats, calculateDosesByDate } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import {
  getActiveProtocols,
  getLogsForPeriod,
  getMedicinesData,
  getUserSettings,
} from '../services/dashboardService'

const TODAY_CACHE_KEY = '@dosiq/today-snapshot'

/**
 * @typedef {{ 
 *   protocols: Array, 
 *   logs: Array, 
 *   medicines: Record<string,Object>,
 *   stats: Object,
 *   zones: Object,
 *   user: Object|null,
 *   capturedAt?: string
 * }} TodayData
 * @returns {{ data: TodayData|null, loading: boolean, error: string|null, stale: boolean, isDaySegregated: boolean, refresh: Function }}
 */
export function useTodayData() {
  // States primeiro (R-010)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  const [isDaySegregated, setIsDaySegregated] = useState(false)
  
  // Ref para snapshot check sem entrar nos deps do useCallback
  const dataRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (__DEV__) console.log('[useTodayData] fetch start')
      
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
      
      let user = currentSession?.user
      if (sessionError || !user) {
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !verifiedUser) throw new Error('Sessão expirada')
        user = verifiedUser
      }

      const today = getTodayLocal()
      
      // Fetch online (primary)
      const [protocols, logs, userSettings] = await Promise.all([
        getActiveProtocols(user.id, today),
        getLogsForPeriod(user.id, 14), // 14 dias de logs para tendências comparativas
        getUserSettings(user.id)
      ])

      const medicineIds = [...new Set(protocols.map((p) => p.medicine_id))]
      const medicines = await getMedicinesData(medicineIds)

      const enrichedProtocols = protocols.map(p => ({
        ...p,
        medicine: medicines[p.medicine_id] || null
      }))

      const newData = { 
        protocols: enrichedProtocols, 
        logs, 
        medicines,
        user: {
          id: user.id,
          email: user.email,
          name: userSettings?.display_name || null
        },
        capturedAt: new Date().toISOString(),
        localDay: today // R-114 fix: save explicit local day string
      }

      // Salvar em cache para uso offline posterior
      await AsyncStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(newData))

      dataRef.current = newData
      setData(newData)
      setStale(false)
      setIsDaySegregated(false)
    } catch (err) {
      if (__DEV__) console.warn('[useTodayData] Fetch failed, trying cache:', err.message)
      
      try {
        const cached = await AsyncStorage.getItem(TODAY_CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          const capturedAt = new Date(parsed.capturedAt)
          const now = new Date()
          const diffHours = (now - capturedAt) / (1000 * 60 * 60)

          // Regra: < 24h
          if (diffHours < 24) {
            const today = getTodayLocal()
            
            // R-114: Prefer explicit localDay from snapshot, fallback to ISO split
            const snapshotDay = parsed.localDay || (parsed.capturedAt ?? '').split('T')[0]
            
            // Regra H5.8: Se dia diferente (comparação local-local), limpar logs
            if (snapshotDay && snapshotDay !== today) {
              if (__DEV__) console.log('[useTodayData] Day mismatch, segregating logs')
              parsed.logs = Array.isArray(parsed.logs) ? [] : []
              setIsDaySegregated(true)
            } else {
              setIsDaySegregated(false)
            }

            // Safety gate: garantir que parsed tem o formato esperado
            const safeData = {
              protocols: Array.isArray(parsed.protocols) ? parsed.protocols : [],
              logs: Array.isArray(parsed.logs) ? parsed.logs : [],
              medicines: parsed.medicines || {},
              user: parsed.user || null,
              capturedAt: parsed.capturedAt
            }

            setData(safeData)
            dataRef.current = safeData
            setStale(true)
            setError(null) 
          } else {
            throw new Error('Cache expirado (> 24h)')
          }
        } else {
          throw err // Re-throw original se não houver cache
        }
      } catch (cacheErr) {
        setError(err.message ?? 'Erro ao carregar dados.')
      }
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
    
    // 0. Resiliência de Cache: Filtrar validade do protocolo para HOJE (GMT-3)
    // Isso protege a UI caso o snapshot no AsyncStorage tenha dados obsoletos.
    const validProtocols = data.protocols.filter(p => isProtocolActiveOnDate(p, todayStr))

    // 1. Filtrar logs de hoje para a Timeline
    const todayLogs = data.logs.filter(l => {
      const logDate = new Date(l.taken_at)
      const lYear = logDate.getFullYear()
      const lMonth = String(logDate.getMonth() + 1).padStart(2, '0')
      const lDay = String(logDate.getDate()).padStart(2, '0')
      return `${lYear}-${lMonth}-${lDay}` === todayStr
    })

    // 2. Classificar doses em zonas para o Dashboard
    const { takenDoses, missedDoses, scheduledDoses } = calculateDosesByDate(
      todayStr,
      todayLogs,
      validProtocols
    )

    // 3. Calcular estatísticas de adesão (Últimos 7 dias - Diluído conforme feedback H8.7)
    const stats = calculateAdherenceStats(
      data.logs,
      validProtocols,
      7,
      0 // Janela atual (D0 a D7)
    )

    // 4. Calcular estatísticas do período anterior para tendência (+5% vs semana passada)
    const statsPrevious = calculateAdherenceStats(
      data.logs,
      validProtocols,
      7,
      7 // Janela anterior (D7 a D14)
    )

    const scoreTrend = statsPrevious.expected > 0 ? (stats.score - statsPrevious.score) : 0

    const statsWithTrend = {
      ...stats,
      trend: scoreTrend,
      hasPreviousData: statsPrevious.expected > 0
    }

    // Ordenar listas cronologicamente (00:00 -> 23:59)
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

    // 4. Nova Timeline Tática (Epic 2 Fase 8)
    const timeline = evaluateDoseTimelineState(todayStr, {
      takenDoses,
      missedDoses,
      scheduledDoses
    })

    // 5. Calcular alertas de estoque
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
      stats: statsWithTrend,
      zones,
      timeline,
      stockAlerts
    }
  }, [data])

  return { 
    data: enhancedData, 
    loading, 
    error, 
    stale, 
    isDaySegregated,
    refresh: load 
  }
}
