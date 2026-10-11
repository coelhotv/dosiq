import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getTodayLocal,
  getNow,
  getRawNow,
  parseISO,
  formatLocalDate,
  getUserTime,
  describeLoadFailure
} from '@dosiq/core'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'
import {
  getActiveProtocols,
  getLogsForPeriod,
  getMedicinesData,
  getUserSettings,
  getDoseInstancesForPeriod,
  getScheduledProtocols,
} from '../services/dashboardService'
import { useTodayDerived } from './_useTodayDerived'
import { setMode, setTreatmentCountBucket } from '@platform/analytics/productAnalytics'
import { protocolService } from '@treatments/services/protocolService'
import { isNetworkError } from '@shared/utils/networkError'
import { onDoseChanged } from '@platform/alarms/doseChangedBus'

const TODAY_CACHE_KEY = '@dosiq/today-snapshot'
// 103 A (FR-A3): no iOS, `inactive → active` acontece a cada puxada da central/Face ID/tela de
// alarme. Vindo de lá, só recarrega se a última carga tiver pelo menos isto.
const FOREGROUND_RELOAD_MIN_MS = 30_000
const MINUTE_MS = 60_000

export function useTodayData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stale, setStale] = useState(false)
  const [isDaySegregated, setIsDaySegregated] = useState(false)
  // 103 A (FR-A2): "agora" do Hoje. Antes congelava na última carga (getRawNow dentro do memo de `data`).
  const [now, setNow] = useState(() => getRawNow())
  const dataRef = useRef(null)
  const lastLoadAtRef = useRef(0)
  // RC5 103 A: só a carga mais recente aplica estado. Foreground, foco, pull e o evento de escrita
  // (FR-A4) disparam cargas concorrentes; uma iniciada ANTES da escrita que termine depois traria a
  // dose de volta a "pendente" (e o relógio a levaria a "atrasada").
  const loadGenRef = useRef(0)
  const appStateRef = useRef(AppState.currentState)
  const enhancedData = useTodayDerived(data, now)

  const handleOnlineSuccess = useCallback(async (user, protocols, logs, medicines, userSettings, today, doseInstances, scheduledProtocols = []) => {
    const enrichedProtocols = protocols.map(p => ({ ...p, medicine: medicines[p.medicine_id] || null }))
    // RC6 #845: agendados também levam o medicamento — a "Próxima dose … · <nome>" usa o nome dele.
    const enrichedScheduled = scheduledProtocols.map(p => ({ ...p, medicine: medicines[p.medicine_id] || null }))
    const newData = {
      protocols: enrichedProtocols,
      // 086 D-13: ativos que ainda não começaram — só para o estado "Nenhuma dose hoje".
      scheduledProtocols: enrichedScheduled,
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

  const handleCacheFallback = useCallback(async (expectedUserId: string | null) => {
    const cached = await AsyncStorage.getItem(TODAY_CACHE_KEY)
    // Sem cache pra tentar (1ª abertura do app, ou storage limpo) — NÃO relançar `originalErr` cru:
    // em modo avião/sem rede ele é um erro de fetch nativo (RN), sempre em inglês, e vazaria pra
    // tela via describeLoadFailure. Mensagem própria, em PT, cobre esse caso (achado no smoke 055).
    if (!cached) throw new Error('Não identificamos conexão com a Internet, nem dados salvos neste aparelho. Conecte-se a rede para continuar.')
    
    const parsed = JSON.parse(cached)
    // Spec 091 (AC-2.4): snapshot só vale para o titular que o gravou. Sem dono no snapshot (formato
    // antigo) ou dono diferente = trata como "sem dados salvos" — nunca exibe agenda de outra pessoa.
    if (!expectedUserId || parsed?.user?.id !== expectedUserId) {
      throw new Error('Não identificamos conexão com a Internet, nem dados salvos neste aparelho. Conecte-se a rede para continuar.')
    }
    const diffHours = (getNow().getTime() - parseISO(parsed.capturedAt).getTime()) / (1000 * 60 * 60)
    // "Cache expirado" é jargão técnico — Dona Maria não sabe o que é cache (achado no smoke 055).
    if (diffHours >= 24) throw new Error('Não identificamos conexão com a Internet e seus dados no app estão desatualizados (mais de 24h). Conecte-se à rede para atualizar.')

    // F4.3f.1: virada de dia no fuso do snapshot (não SP fixo) — segregação correta p/ expat.
    const tz = parsed.timezone || 'America/Sao_Paulo'
    const today = getTodayLocal(tz)
    // Sem localDay (snapshot antigo): dia do capturedAt no fuso do snapshot — o corte do ISO dava o
    // dia UTC e segregava à noite (AP-342, spec 077). Sem capturedAt → '' (não segrega), como antes.
    const snapshotDay = parsed.localDay || (parsed.capturedAt ? formatLocalDate(getUserTime(parseISO(parsed.capturedAt), tz)) : '')

    if (snapshotDay && snapshotDay !== today) {
      parsed.logs = []
      setIsDaySegregated(true)
    } else {
      setIsDaySegregated(false)
    }

    const safeData = {
      protocols: Array.isArray(parsed.protocols) ? parsed.protocols : [],
      scheduledProtocols: Array.isArray(parsed.scheduledProtocols) ? parsed.scheduledProtocols : [],
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
    const gen = ++loadGenRef.current
    const isLatest = () => gen === loadGenRef.current
    lastLoadAtRef.current = getRawNow().getTime()
    setLoading(true)
    setError(null)
    let sessionUserId: string | null = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      sessionUserId = session?.user?.id ?? null
      const user = session?.user || (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('Sessão expirada')

      const today = getTodayLocal()
      const [protocols, logs, userSettings, doseInstances, scheduledProtocols] = await Promise.all([
        getActiveProtocols(user.id, today),
        getLogsForPeriod(user.id, 14),
        getUserSettings(user.id),
        getDoseInstancesForPeriod(user.id, 14),
        // Best-effort: falhar aqui não pode derrubar a agenda do dia — sem ela, cai no estado atual.
        getScheduledProtocols(user.id, today).catch(() => []),
      ])

      // 065/US4: `mode` como super property nasce AQUI, e não só no `useProfile`. Medido no
      // PostHog com o app de dev rodando: `mode` saía `(null)` em todo evento, porque o
      // `useProfile` só monta nas telas de Perfil/Tratamentos — uma sessão que fica no Dashboard
      // (o caso comum) nunca registrava a propriedade, e a segmentação da US4 nasceria quase vazia.
      // O Dashboard é a tela inicial e já carrega `user_settings`: é o primeiro ponto do app em que
      // o valor existe. Fail-silent por contrato (CON-021).
      void setMode(userSettings?.complexity_override)

      // F4.3f.1: localDay no fuso do perfil (segregação de cache cross-dia correta p/ expat).
      const tz = userSettings?.timezone || 'America/Sao_Paulo'
      const localDay = getTodayLocal(tz)
      // 092 FR-002: persona por volume de tratamentos, no mesmo ponto do `mode`. Fire-and-forget e
      // fora do caminho da agenda: `getAll` traz TODOS os protocolos do dono (pausados e futuros
      // inclusive — a regra filtra no core). Falha ⇒ não registra (AC-2.2), o Hoje segue igual.
      // RC6 #862: logout durante o `getAll` roda `resetUser` ANTES do register — a faixa vazaria para
      // a sessão seguinte no aparelho. Só registra se a sessão ainda é de quem carregou.
      const loadedUserId = user.id
      void protocolService.getAll()
        .then(async (rows) => {
          const { data: { session: current } } = await supabase.auth.getSession()
          if (current?.user?.id !== loadedUserId) return
          await setTreatmentCountBucket(rows, localDay)
        })
        .catch(() => {})
      const medicines = await getMedicinesData([...new Set([...protocols, ...scheduledProtocols].map(p => p.medicine_id))])
      if (!isLatest()) return
      await handleOnlineSuccess(user, protocols, logs, medicines, userSettings, localDay, doseInstances, scheduledProtocols)
    } catch (err) {
      if (!isLatest()) return
      // Spec 091 (FR-006): só QUEDA DE REDE cai no snapshot. Erro de sessão/servidor/código mostrado
      // como "sem conexão" escondia conta excluída atrás da própria agenda (smoke do 065 PR D).
      if (!isNetworkError(err)) {
        setError(describeLoadFailure(err, err))
        return
      }
      try {
        await handleCacheFallback(sessionUserId)
      } catch (fallbackErr) {
        // AP-314: erro de servidor (42703, 42501…) tem precedência sobre "Cache expirado" —
        // sem isso, schema quebrado em produção se disfarça de app offline.
        setError(describeLoadFailure(err, fallbackErr))
      }
    } finally {
      if (isLatest()) setLoading(false)
    }
  }, [handleOnlineSuccess, handleCacheFallback])

  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [load])

  // 103 A — relógio + foreground + escrita fora do Hoje. Um listener de AppState só (RC3 A-5).
  useEffect(() => {
    let timeoutId = null
    let intervalId = null

    // Virada de dia no fuso do snapshot ⇒ dados de ontem não servem (RC3 A-4).
    const dayChanged = () => {
      const d = dataRef.current
      return !!d?.localDay && d.localDay !== getTodayLocal(d.timezone || 'America/Sao_Paulo')
    }

    // Tick só recalcula as zonas — sem rede (INV-2), exceto quando o dia vira.
    const tick = () => {
      setNow(getRawNow())
      if (dayChanged()) load()
    }

    const stopClock = () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
      timeoutId = null
      intervalId = null
    }

    // Alinhado ao minuto cheio: os horários de dose são HH:MM (RC3 A-3).
    const startClock = () => {
      stopClock()
      const msToNextMinute = MINUTE_MS - (getRawNow().getTime() % MINUTE_MS)
      timeoutId = setTimeout(() => {
        tick()
        intervalId = setInterval(tick, MINUTE_MS)
      }, msToNextMinute)
    }

    const handleStateChange = (nextState) => {
      const prevState = appStateRef.current
      appStateRef.current = nextState
      if (nextState !== 'active') {
        stopClock()
        return
      }
      // FR-A1: zonas com o "agora" atual sempre (barato).
      setNow(getRawNow())
      startClock()
      // FR-A3: recarga só vindo de background (doses podem ter sido resolvidas fora), dia virado ou
      // última carga velha — nunca a cada puxada da central de notificações.
      const sinceLoad = getRawNow().getTime() - lastLoadAtRef.current
      if (prevState === 'background' || dayChanged() || sinceLoad >= FOREGROUND_RELOAD_MIN_MS) load()
    }

    if (AppState.currentState === 'active') startClock()
    const subscription = AppState.addEventListener('change', handleStateChange)
    // FR-A4: escrita de dose fora do Hoje (notificação/LA/tela cheia) é ação do usuário — sem freio.
    const unsubscribeDose = onDoseChanged(() => { load() })
    return () => {
      stopClock()
      subscription.remove()
      unsubscribeDose()
    }
  }, [load])

  return { data: enhancedData, loading, error, stale, isDaySegregated, refresh: load }
}
