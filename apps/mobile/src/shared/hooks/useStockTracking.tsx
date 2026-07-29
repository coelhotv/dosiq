// useStockTracking — preferência GLOBAL de controle de estoque (spec 044, F3; cache 055-W1.7).
//
// A preferência mora no backend (user_settings.stock_tracking_enabled) e é lida DENTRO
// das RPCs atômicas. Este provider é só a leitura para a UI: as superfícies de estoque
// somem quando `enabled === false`. Nunca é a fonte de verdade do consumo FIFO — quem
// decide isso é o banco (evita divergência multi-device, AP-231). O cache local (AsyncStorage)
// é só da PREFERÊNCIA, nunca do saldo.
//
// Escada de 3 degraus (emenda a AP-277 — ver .agent/memory/anti-patterns 044 F1 pós-055):
//   1. remoto OK       → usa e cacheia
//   2. remoto falha, HÁ cache → usa o cache (preserva uma decisão explícita do usuário)
//   3. remoto falha, SEM cache → default ATIVO (fail-safe original do AP-277 — 1ª abertura,
//      storage limpo; "nunca soube da preferência" ainda é diferente de "sei que desligou")
// Rede sempre vence o cache quando disponível (AP-284 — multi-device continua revalidando
// em AppState 'active'; o cache nunca é fonte de verdade, só fallback de falha).
//
// `ready` não depende mais de rede: com cache presente, a tab bar monta na hora (evita
// spinner à toa offline antes de cair no default). Sem cache, `ready` só fecha após a
// tentativa remota resolver (sucesso ou falha) — aí sim aplica o degrau 3.

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'
import { createProfileRepository } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { readStockTrackingCache, writeStockTrackingCache } from '@platform/storage/stockTrackingCache'

// Consome o repositório do core DIRETO (não via profileService): importar a casca de
// serviço arrastaria um módulo nível B para dentro do programa strict desta ilha (AP-274).
async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

const profileRepo = createProfileRepository({ client: supabase as never, getUserId })

type StockTrackingValue = {
  enabled: boolean
  pausedAt: string | null
  ready: boolean
  refresh: () => Promise<void>
}

const DEFAULT_VALUE: StockTrackingValue = {
  enabled: true,
  pausedAt: null,
  ready: true,
  refresh: async () => {},
}

const StockTrackingContext = createContext<StockTrackingValue>(DEFAULT_VALUE)

type ProviderProps = {
  children: ReactNode
  session?: unknown
}

export function StockTrackingProvider({ children, session = undefined }: ProviderProps) {
  const [enabled, setEnabled] = useState<boolean>(true)
  const [pausedAt, setPausedAt] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!session) {
      // Sem sessão não há preferência a ler — não trava a árvore.
      setReady(true)
      return
    }

    // Degrau 2 tentado PRIMEIRO e otimisticamente: se há cache, a UI já pode montar com ele
    // (ready=true) sem esperar a rede — a rede, quando resolver, sempre sobrescreve (AP-284).
    const cached = await readStockTrackingCache()
    if (cached) {
      setEnabled(cached.enabled)
      setPausedAt(cached.pausedAt)
      setReady(true)
    }

    try {
      const pref = await profileRepo.getStockTracking()
      const nextEnabled = pref.stock_tracking_enabled !== false
      const nextPausedAt = pref.stock_paused_at ?? null
      setEnabled(nextEnabled)
      setPausedAt(nextPausedAt)
      await writeStockTrackingCache({ enabled: nextEnabled, pausedAt: nextPausedAt })
    } catch {
      // Degrau 3: sem cache, o fail-safe original do AP-277 vale — nunca soube da
      // preferência, então ativa. COM cache, o valor já setado acima (degrau 2) fica.
      if (!cached) {
        setEnabled(true)
        setPausedAt(null)
      }
    } finally {
      setReady(true)
    }
  }, [session])

  // R-010: o memo do value depende de `refresh` (useCallback) — a ordem aqui é imposta pela
  // dependência, não por descuido.
  // eslint-disable-next-line no-restricted-syntax
  const value = useMemo(
    () => ({ enabled, pausedAt, ready, refresh }),
    [enabled, pausedAt, ready, refresh],
  )

  // Sincroniza com um sistema externo (a preferência no backend): o setState acontece no
  // callback assíncrono de `refresh`, não no corpo do effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  // Revalidação multi-device: a preferência é uma POLÍTICA DE CONTA, não um estado de tela —
  // desligar o estoque na web tem que refletir no celular que estava minimizado. O `refresh()`
  // do AP-281 só cobre a escrita feita NESTE device; aqui cobrimos a escrita feita em OUTRO.
  // Ponto de retomada = volta ao primeiro plano (1 query numa linha; sem polling e sem canal
  // realtime vivo para um valor que muda uma vez por mês).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (next === 'active') refresh()
    })
    return () => sub.remove()
  }, [refresh])

  return (
    <StockTrackingContext.Provider value={value}>
      {children}
    </StockTrackingContext.Provider>
  )
}

export function useStockTracking(): StockTrackingValue {
  return useContext(StockTrackingContext)
}
