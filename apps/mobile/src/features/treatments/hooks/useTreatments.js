// useTreatments.js — hook para listagem de tratamentos
// Padrão: { data, loading, error, stale, refresh }

import { useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getActiveTreatments } from '../services/treatmentsService'

const TREATMENTS_CACHE_KEY = '@meus-remedios/treatments-snapshot'

/**
 * @typedef {{ id: string, name: string, frequency: string, time_schedule: string[], dosage_per_intake: number, titration_status: string, medicine: { name: string, type: string } }} Treatment
 * @returns {{ data: Treatment[]|null, loading: boolean, error: string|null, stale: boolean, refresh: Function }}
 */
export function useTreatments() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  const dataRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      const user = authData?.user
      if (authError || !user) throw new Error('Sessão expirada.')

      const result = await getActiveTreatments(user.id)
      
      if (!result.success) throw new Error(result.error)

      const newData = result.data
      const snapshot = {
        data: newData,
        capturedAt: new Date().toISOString()
      }

      await AsyncStorage.setItem(TREATMENTS_CACHE_KEY, JSON.stringify(snapshot))

      dataRef.current = newData
      setData(newData)
      setStale(false)
    } catch (err) {
      if (__DEV__) console.warn('[useTreatments] Fetch failed, checking cache:', err.message)
      
      try {
        const cached = await AsyncStorage.getItem(TREATMENTS_CACHE_KEY)
        if (cached) {
          const parsed = JSON.parse(cached)
          const capturedAt = new Date(parsed.capturedAt)
          const now = new Date()
          const diffHours = (now - capturedAt) / (1000 * 60 * 60)

          if (diffHours < 24) {
            setData(parsed.data)
            dataRef.current = parsed.data
            setStale(true)
            setError(null)
          } else {
            throw new Error('Cache expirado')
          }
        } else {
          throw err
        }
      } catch (cacheErr) {
        setError(err.message ?? 'Erro ao carregar tratamentos.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, stale, refresh: load }
}
