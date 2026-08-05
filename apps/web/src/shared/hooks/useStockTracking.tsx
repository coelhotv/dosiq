/**
 * useStockTracking — preferência GLOBAL de controle de estoque (spec 044, F3).
 *
 * Espelho web do provider mobile: MESMA preferência, MESMA fonte (backend), para que a web
 * não consuma FIFO enquanto o mobile não consome (corrupção de dado — classe AP-231).
 * A decisão de consumo é sempre do banco (RPCs atômicas leem a preferência dentro da txn);
 * aqui é só render condicional.
 *
 * Fail-safe (AP-277): erro de leitura ou linha ausente → estoque ATIVO (FR-009).
 * `ready` evita piscar a sidebar com "Estoque" antes de saber que o usuário é dose-only.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { supabase, getUserId } from '@shared/utils/supabase'
import { createProfileRepository } from '@dosiq/core'

const profileRepo = createProfileRepository({ client: supabase, getUserId })

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
  const [ready, setReady] = useState<boolean>(false)

  const refresh = useCallback(async () => {
    if (!session) {
      setReady(true)
      return
    }
    try {
      const pref = await profileRepo.getStockTracking()
      setEnabled(pref.stock_tracking_enabled !== false)
      setPausedAt(pref.stock_paused_at ?? null)
    } catch {
      setEnabled(true)
      setPausedAt(null)
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

  // Revalidação multi-device (espelho do mobile): a preferência é uma POLÍTICA DE CONTA — se o
  // usuário desligou o estoque no celular, a aba que ficou aberta aqui não pode seguir mostrando
  // saldos. Ponto de retomada = a aba voltar ao foco/visível. Sem polling, sem canal realtime.
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState !== 'visible') return
      refresh()
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [refresh])

  return (
    <StockTrackingContext.Provider value={value}>
      {children}
    </StockTrackingContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStockTracking(): StockTrackingValue {
  return useContext(StockTrackingContext)
}
