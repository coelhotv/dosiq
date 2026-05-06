import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { 
  getTodayLocal, 
  getNow,
  parseISO
} from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import {
  getActiveProtocols,
  getLogsForPeriod,
  getMedicinesData,
  getUserSettings,
} from '../services/dashboardService'
import { useTodayDerived } from './_useTodayDerived'

const TODAY_CACHE_KEY = '@dosiq/today-snapshot'

export function useTodayData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  const [isDaySegregated, setIsDaySegregated] = useState(false)
  const dataRef = useRef(null)
  const enhancedData = useTodayDerived(data)

  const handleOnlineSuccess = useCallback(async (user, protocols, logs, medicines, userSettings, today) => {
    const enrichedProtocols = protocols.map(p => ({ ...p, medicine: medicines[p.medicine_id] || null }))
    const newData = {
      protocols: enrichedProtocols,
      logs,
      medicines,
      user: {
        id: user.id,
        email: user.email,
        name: userSettings?.display_name || null,
        complexity_override: userSettings?.complexity_override || null
      },
      capturedAt: getNow().toISOString(),
      localDay: today
    }
    await AsyncStorage.setItem(TODAY_CACHE_KEY, JSON.stringify(newData))
    dataRef.current = newData
    setData(newData)
    setStale(false)
    setIsDaySegregated(false)
  }, [])

  const handleCacheFallback = useCallback(async (originalErr) => {
    const cached = await AsyncStorage.getItem(TODAY_CACHE_KEY)
    if (!cached) throw originalErr
    
    const parsed = JSON.parse(cached)
    const diffHours = (getNow().getTime() - parseISO(parsed.capturedAt).getTime()) / (1000 * 60 * 60)
    if (diffHours >= 24) throw new Error('Cache expirado (> 24h)')

    const today = getTodayLocal()
    const snapshotDay = parsed.localDay || (parsed.capturedAt ?? '').split('T')[0]
    
    if (snapshotDay && snapshotDay !== today) {
      parsed.logs = []
      setIsDaySegregated(true)
    } else {
      setIsDaySegregated(false)
    }

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
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user || (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('Sessão expirada')

      const today = getTodayLocal()
      const [protocols, logs, userSettings] = await Promise.all([
        getActiveProtocols(user.id, today),
        getLogsForPeriod(user.id, 14),
        getUserSettings(user.id)
      ])

      const medicines = await getMedicinesData([...new Set(protocols.map(p => p.medicine_id))])
      await handleOnlineSuccess(user, protocols, logs, medicines, userSettings, today)
    } catch (err) {
      try {
        await handleCacheFallback(err)
      } catch (fallbackErr) {
        setError(fallbackErr.message ?? 'Erro ao carregar dados.')
      }
    } finally {
      setLoading(false)
    }
  }, [handleOnlineSuccess, handleCacheFallback])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handleStateChange = (nextState) => {
      if (nextState === 'active' && dataRef.current?.localDay && dataRef.current.localDay !== getTodayLocal()) {
        load()
      }
    }
    const subscription = AppState.addEventListener('change', handleStateChange)
    return () => subscription.remove()
  }, [load])

  return { data: enhancedData, loading, error, stale, isDaySegregated, refresh: load }
}
