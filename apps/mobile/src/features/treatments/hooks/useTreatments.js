// useTreatments.js — hook para listagem de tratamentos
// Padrão: { data, loading, error, stale, refresh }

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getActiveTreatments } from '../services/treatmentsService'

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
      const { data, error: authError } = await supabase.auth.getUser()
      const user = data?.user
      if (authError || !user) throw new Error('Sessão expirada.')

      const result = await getActiveTreatments(user.id)
      
      if (!result.success) {
        throw new Error(result.error)
      }

      dataRef.current = result.data
      setData(result.data)
      setStale(false)
    } catch (err) {
      if (__DEV__) console.error('[useTreatments] Erro:', err.message)
      setError(err.message ?? 'Erro ao carregar tratamentos.')
      if (dataRef.current !== null) setStale(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, stale, refresh: load }
}
