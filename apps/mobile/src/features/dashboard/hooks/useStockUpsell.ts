// useStockUpsell — visibilidade + dismiss + tracking do card de upsell de estoque na
// TodayScreen (spec 044, F4b / T018). Consome `evaluateStockUpsell` (função PURA,
// @dosiq/core) já testada — aqui só se decide QUANDO mostrar.
// 100% client-side (R-090): `useTodayData` só carrega 14 dias de logs (curtos demais pro
// critério de 14 dias consecutivos "ancorado no presente" ter folga) — busca própria e
// enxuta (só `taken_at`, 30 dias) via `getDoseLogDatesForPeriod`, sem inventar service novo.
//
// Dismiss é LOCAL e PERSISTENTE, sem re-nag: "Agora não" grava uma flag via
// `nativeStorageAdapter` (abstração de storage do projeto, H3.1 — nunca AsyncStorage cru
// quando a abstração existe) e o card some para sempre, mesmo que o gatilho continue
// verdadeiro em sessões futuras.
//
// AP-270/AP-171: dia local de cada dose derivado com `getUserTime`/`formatLocalDate`
// (@dosiq/core) — nunca `toISOString().split('T')[0]` nem `toLocaleDateString` (Hermes cai
// em formato US).

import { useState, useEffect, useMemo, useCallback } from 'react'
import { evaluateStockUpsell, formatLocalDate, getUserTime, parseISO, getTodayLocal } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { nativeStorageAdapter } from '@platform/storage/nativeStorageAdapter'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { getDoseLogDatesForPeriod } from '@dashboard/services/dashboardService'
import { trackStockUpsellShown, trackStockUpsellDismissed } from '@profile/services/stockPreferenceService'

const DISMISS_KEY = 'dosiq:stock-upsell-dismissed'

// Guarda de módulo: `trackStockUpsellShown()` dispara UMA vez por sessão de app, não a
// cada remount do hook (trocar de aba e voltar pra Hoje não deve re-contar).
let hasTrackedShownThisSession = false

type UseStockUpsellResult = {
  visible: boolean
  dismiss: () => void
}

export function useStockUpsell(timezone: string = 'America/Sao_Paulo'): UseStockUpsellResult {
  // 1. States
  const [dismissed, setDismissed] = useState<boolean | null>(null) // null = storage ainda não lido
  const [loggedDays, setLoggedDays] = useState<string[]>([])

  // 2. Context
  const { enabled, ready } = useStockTracking()

  // 3. Memos
  const evaluation = useMemo(
    () => evaluateStockUpsell(loggedDays, getTodayLocal(timezone)),
    [loggedDays, timezone]
  )

  const visible = ready && dismissed === false && !enabled && evaluation.eligible

  // 4. Effects
  useEffect(() => {
    let cancelled = false
    nativeStorageAdapter.getItem(DISMISS_KEY).then((raw) => {
      if (!cancelled) setDismissed(raw === '1')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadDoses() {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled) return // desmontou durante o getUser: não busca os logs à toa
      const userId = data?.user?.id
      if (error || !userId) return
      try {
        const logs = await getDoseLogDatesForPeriod(userId, 30)
        if (cancelled) return
        setLoggedDays(
          (logs || [])
            .map((log) => log?.taken_at)
            .filter(Boolean)
            .map((takenAt) => formatLocalDate(getUserTime(parseISO(takenAt), timezone)))
        )
      } catch {
        // Falha silenciosa: o card simplesmente não aparece nesta sessão (não bloqueia a tela).
      }
    }
    loadDoses()
    return () => {
      cancelled = true
    }
  }, [timezone])

  useEffect(() => {
    if (!visible || hasTrackedShownThisSession) return
    hasTrackedShownThisSession = true
    trackStockUpsellShown()
  }, [visible])

  // 5. Handlers
  const dismiss = useCallback(() => {
    setDismissed(true)
    trackStockUpsellDismissed()
    void nativeStorageAdapter.setItem(DISMISS_KEY, '1')
  }, [])

  return { visible, dismiss }
}
