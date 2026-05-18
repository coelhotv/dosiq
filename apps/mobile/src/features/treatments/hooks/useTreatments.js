// useTreatments.js — hook para listagem de tratamentos
// Padrão: { data, loading, error, stale, refresh }

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTodayLocal, getNow, addDays, parseISO } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getAllTreatments } from '../services/treatmentsService'
import { debugLog } from '@shared/utils/debugLog'
import { transformTreatments } from './_treatmentsTransformer'

const TREATMENTS_CACHE_KEY = '@dosiq/treatments-snapshot'

/**
 * @typedef {{ id: string, name: string, frequency: string, time_schedule: string[], dosage_per_intake: number, titration_status: string, medicine: { name: string, type: string } }} Treatment
 * @returns {{ data: Treatment[]|null, loading: boolean, error: string|null, stale: boolean, refresh: Function, activeTab: string, setActiveTab: Function, counts: {ativos:number,pausados:number,finalizados:number}, ativos: Treatment[], pausados: Treatment[], finalizados: Treatment[], groups: object[]|null, currentItems: Treatment[] }}
 */
export function useTreatments() {
  // States (R-010: states first)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  const [activeTab, setActiveTab] = useState('ativos')
  const dataRef = useRef(null)

  const load = useCallback(async () => {
    // ... codigo de load ...
    setLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      const user = authData?.user
      if (authError || !user) throw new Error('Sessão expirada.')

      const result = await getAllTreatments(user.id)

      if (!result.success) throw new Error(result.error)

      const newData = result.data
      const today = getTodayLocal()
      const snapshot = {
        data: newData,
        capturedAt: getNow().toISOString(),
        localDay: today // R-114 fix
      }

      await AsyncStorage.setItem(TREATMENTS_CACHE_KEY, JSON.stringify(snapshot))

      dataRef.current = { data: newData, localDay: today }
      setData(newData)
      setStale(false)
    } catch (err) {
      if (__DEV__) console.warn('[useTreatments] Fetch failed, checking cache:', err.message)
      
      try {
        const cached = await AsyncStorage.getItem(TREATMENTS_CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          const capturedAt = parseISO(parsed.capturedAt)
          const now = getNow()
          const diffHours = (now - capturedAt) / (1000 * 60 * 60)

          if (diffHours < 24) {
            setData(parsed.data)
            dataRef.current = { data: parsed.data, localDay: parsed.localDay }
            setStale(true)
            setError(null)
          } else {
            throw new Error('Cache expirado')
          }
        } else {
          throw err
        }
      } catch {
        setError(err.message ?? 'Erro ao carregar tratamentos.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [load])

  // Lógica de Refresh de Meia-Noite e AppState (R-184)
  useEffect(() => {
    let midnightTimer

    const scheduleMidnightRefresh = () => {
      const now = getNow()
      const nextMidnight = addDays(now, 1)
      nextMidnight.setHours(0, 0, 0, 0)
      
      const msUntilMidnight = nextMidnight.getTime() - now.getTime()
      
      clearTimeout(midnightTimer)
      midnightTimer = setTimeout(() => {
        debugLog('useTreatments', 'Meia-noite detectada: Refreshing...')
        load()
        scheduleMidnightRefresh()
      }, msUntilMidnight + 1000)
    }

    scheduleMidnightRefresh()

    const handleStateChange = (nextState) => {
      if (nextState === 'active') {
        const today = getTodayLocal()
        if (dataRef.current?.localDay && dataRef.current.localDay !== today) {
          debugLog('useTreatments', 'Dia alterado via background: Refreshing...')
          load()
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleStateChange)
    return () => {
      subscription.remove()
      clearTimeout(midnightTimer)
    }
  }, [load])

  // Memos (R-010: memos after states)
  const transformed = useMemo(() => transformTreatments(data), [data])

  const currentItems = useMemo(
    () => transformed[activeTab] ?? [],
    [transformed, activeTab]
  )

  const result = useMemo(() => ({
    // shape legado — compat com callsites existentes
    data: transformed.data,
    loading,
    error,
    stale,
    refresh: load,
    // shape Fase 2.5
    activeTab,
    setActiveTab,
    counts: transformed.counts ?? { ativos: 0, pausados: 0, finalizados: 0 },
    ativos: transformed.ativos ?? [],
    pausados: transformed.pausados ?? [],
    finalizados: transformed.finalizados ?? [],
    groups: transformed.groups ?? [],
    currentItems,
  }), [transformed, loading, error, stale, load, activeTab, currentItems])

  return result
}
