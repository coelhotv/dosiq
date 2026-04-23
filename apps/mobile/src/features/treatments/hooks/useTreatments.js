// useTreatments.js — hook para listagem de tratamentos
// Padrão: { data, loading, error, stale, refresh }

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTodayLocal, isProtocolActiveOnDate } from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import { getActiveTreatments } from '../services/treatmentsService'

const TREATMENTS_CACHE_KEY = '@dosiq/treatments-snapshot'

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
    // ... codigo de load ...
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

  // Resilience layer (Rule R-175): Filtrar validade para HOJE local.
  // Garante que mesmo que o snapshot no cache tenha dados de ontem, a UI oculte os expirados.
  // Resilience layer + Grouping (Rule R-175): Organizar por Planos/Classes
  const groupedData = useMemo(() => {
    if (!data) return null
    const today = getTodayLocal()
    
    // 1. Filtrar ativos para hoje e ordenar por horário da primeira dose
    const validProtocols = data
      .filter(p => isProtocolActiveOnDate(p, today))
      .sort((a, b) => {
        const timeA = (a.time_schedule && a.time_schedule[0]) || '99:99'
        const timeB = (b.time_schedule && b.time_schedule[0]) || '99:99'
        return timeA.localeCompare(timeB)
      })

    // 2. Agrupar
    const groupsMap = {}
    
    validProtocols.forEach(p => {
      let groupId, groupName, groupEmoji, groupColor
      
      if (p.treatment_plan) {
        // Via Plano de Tratamento (Prioridade 1)
        groupId = p.treatment_plan.id
        groupName = p.treatment_plan.name
        groupEmoji = p.treatment_plan.emoji
        groupColor = p.treatment_plan.color
      } else if (p.medicine?.therapeutic_class) {
        // Via Classe Terapêutica (Prioridade 2 - Fallback)
        groupId = `class-${p.medicine.therapeutic_class}`
        groupName = p.medicine.therapeutic_class
        groupEmoji = '🧪'
        groupColor = '#94a3b8' 
      } else {
        // Outros (Prioridade 3)
        groupId = 'general'
        groupName = 'Outros Tratamentos'
        groupEmoji = '💊'
        groupColor = '#cbd5e1'
      }

      if (!groupsMap[groupId]) {
        groupsMap[groupId] = {
          id: groupId,
          title: groupName,
          emoji: groupEmoji,
          color: groupColor,
          protocols: []
        }
      }
      groupsMap[groupId].protocols.push(p)
    })

    // Converter para array e ordenar grupos (Planos primeiro, depois alfabético)
    return Object.values(groupsMap).sort((a, b) => {
      if (a.id === 'general') return 1
      if (b.id === 'general') return -1
      return a.title.localeCompare(b.title)
    })
  }, [data])

  return { data: groupedData, loading, error, stale, refresh: load }
}
