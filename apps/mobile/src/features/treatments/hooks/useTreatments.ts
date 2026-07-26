// useTreatments.js — hook para listagem de tratamentos
// Padrão: { data, loading, error, stale, refresh }

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTodayLocal, getNow, addDays, parseISO, describeLoadFailure } from '@dosiq/core'
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
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  const [activeTab, setActiveTab] = useState('ativos')
  const dataRef = useRef(null)
  const loadRef = useRef(null)

  // Memos (R-010: memos after states)
  const transformed = useMemo(() => transformTreatments(data), [data])

  const currentItems = useMemo(
    () => transformed[activeTab] ?? [],
    [transformed, activeTab]
  )

  const refresh = useMemo(() => () => {
    if (loadRef.current) {
      loadRef.current()
    }
  }, [])

  const result = useMemo(() => ({
    // shape legado — compat com callsites existentes
    data: transformed.data,
    loading,
    hasLoaded,
    error,
    stale,
    refresh,
    // shape Fase 2.5
    activeTab,
    setActiveTab,
    counts: transformed.counts ?? { ativos: 0, pausados: 0, finalizados: 0 },
    ativos: transformed.ativos ?? [],
    pausados: transformed.pausados ?? [],
    finalizados: transformed.finalizados ?? [],
    // NÃO coalescer p/ `[]`: `null` (sem dado, veio de erro sem fallback) vs `[]` (sucesso, zero
    // tratamentos) é a distinção que TreatmentsScreen.tsx usa (`state.error && !state.groups`)
    // pra escolher entre ErrorState e EmptyState. Coalescer aqui apagava esse sinal na fronteira
    // hook→tela e fazia offline-sem-cache cair silenciosamente no empty state (achado no smoke 055).
    groups: transformed.groups,
    currentItems,
  }), [transformed, loading, hasLoaded, error, stale, refresh, activeTab, currentItems])

  const load = useCallback(async () => {
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
          const diffHours = (now.getTime() - capturedAt.getTime()) / (1000 * 60 * 60)

          if (diffHours < 24) {
            setData(parsed.data)
            dataRef.current = { data: parsed.data, localDay: parsed.localDay }
            setStale(true)
            setError(null)
          } else {
            // "Cache expirado" é jargão técnico — Dona Maria não sabe o que é cache (achado no smoke 055).
            throw new Error('Não identificamos conexão com a Internet e seus dados no app estão desatualizados (mais de 24h). Conecte-se à rede para atualizar.')
          }
        } else {
          // Sem cache pra tentar (1ª abertura, ou storage limpo) — não relançar `err` cru: em
          // modo avião/sem rede é erro de fetch nativo (RN), sempre em inglês, e vazaria pra tela
          // via describeLoadFailure. Mensagem própria em PT (achado no smoke 055).
          throw new Error('Não identificamos conexão com a Internet, nem dados salvos neste aparelho. Conecte-se a rede para continuar.')
        }
      } catch (fallbackErr) {
        // AP-314: expõe o código quando o servidor respondeu (42703, 42501…) — o motivo real
        // não pode ficar atrás de "Cache expirado".
        setError(describeLoadFailure(err, fallbackErr, 'Erro ao carregar tratamentos.'))
      }
    } finally {
      setLoading(false)
      // Marca que a 1ª resolução terminou (sucesso/cache/erro). Gate de UI usa
      // isto pra evitar flash do empty state antes dos dados chegarem (groups
      // é sempre array, então `!groups` nunca pegava o load inicial).
      setHasLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadRef.current = load
  })

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

  return result
}
