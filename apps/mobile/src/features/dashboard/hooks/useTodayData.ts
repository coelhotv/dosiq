import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getTodayLocal,
  getNow,
  parseISO,
  describeLoadFailure
} from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import {
  getActiveProtocols,
  getLogsForPeriod,
  getMedicinesData,
  getUserSettings,
  getDoseInstancesForPeriod,
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

  const handleOnlineSuccess = useCallback(async (user, protocols, logs, medicines, userSettings, today, doseInstances) => {
    const enrichedProtocols = protocols.map(p => ({ ...p, medicine: medicines[p.medicine_id] || null }))
    const newData = {
      protocols: enrichedProtocols,
      logs,
      doseInstances: doseInstances ?? [],
      medicines,
      // F4.3f.1: fuso do perfil propagado p/ _useTodayDerived (timeline/carry-over no tz). SP fallback.
      timezone: userSettings?.timezone || 'America/Sao_Paulo',
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

  const handleCacheFallback = useCallback(async () => {
    const cached = await AsyncStorage.getItem(TODAY_CACHE_KEY)
    // Sem cache pra tentar (1ª abertura do app, ou storage limpo) — NÃO relançar `originalErr` cru:
    // em modo avião/sem rede ele é um erro de fetch nativo (RN), sempre em inglês, e vazaria pra
    // tela via describeLoadFailure. Mensagem própria, em PT, cobre esse caso (achado no smoke 055).
    if (!cached) throw new Error('Não identificamos conexão com a Internet, nem dados salvos neste aparelho. Conecte-se a rede para continuar.')
    
    const parsed = JSON.parse(cached)
    const diffHours = (getNow().getTime() - parseISO(parsed.capturedAt).getTime()) / (1000 * 60 * 60)
    // "Cache expirado" é jargão técnico — Dona Maria não sabe o que é cache (achado no smoke 055).
    if (diffHours >= 24) throw new Error('Não identificamos conexão com a Internet e seus dados no app estão desatualizados (mais de 24h). Conecte-se à rede para atualizar.')

    // F4.3f.1: virada de dia no fuso do snapshot (não SP fixo) — segregação correta p/ expat.
    const tz = parsed.timezone || 'America/Sao_Paulo'
    const today = getTodayLocal(tz)
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
      doseInstances: Array.isArray(parsed.doseInstances) ? parsed.doseInstances : [],
      medicines: parsed.medicines || {},
      timezone: tz,
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
      const [protocols, logs, userSettings, doseInstances] = await Promise.all([
        getActiveProtocols(user.id, today),
        getLogsForPeriod(user.id, 14),
        getUserSettings(user.id),
        getDoseInstancesForPeriod(user.id, 14)
      ])

      // F4.3f.1: localDay no fuso do perfil (segregação de cache cross-dia correta p/ expat).
      const tz = userSettings?.timezone || 'America/Sao_Paulo'
      const localDay = getTodayLocal(tz)
      const medicines = await getMedicinesData([...new Set(protocols.map(p => p.medicine_id))])
      await handleOnlineSuccess(user, protocols, logs, medicines, userSettings, localDay, doseInstances)
    } catch (err) {
      try {
        await handleCacheFallback()
      } catch (fallbackErr) {
        // AP-314: erro de servidor (42703, 42501…) tem precedência sobre "Cache expirado" —
        // sem isso, schema quebrado em produção se disfarça de app offline.
        setError(describeLoadFailure(err, fallbackErr))
      }
    } finally {
      setLoading(false)
    }
  }, [handleOnlineSuccess, handleCacheFallback])

  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [load])

  useEffect(() => {
    const handleStateChange = (nextState) => {
      if (nextState === 'active' && dataRef.current?.localDay && dataRef.current.localDay !== getTodayLocal(dataRef.current.timezone || 'America/Sao_Paulo')) {
        load()
      }
    }
    const subscription = AppState.addEventListener('change', handleStateChange)
    return () => subscription.remove()
  }, [load])

  return { data: enhancedData, loading, error, stale, isDaySegregated, refresh: load }
}
