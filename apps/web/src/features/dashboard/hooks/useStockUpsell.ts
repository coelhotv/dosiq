// useStockUpsell — visibilidade + dismiss + tracking do card de upsell de estoque no
// dashboard (spec 044, F4b / T018). Consome `evaluateStockUpsell` (função PURA, @dosiq/core)
// já testada — aqui só se decide QUANDO mostrar, nada de regra de gatilho nova.
// 100% client-side (R-090): reusa `logs` já carregados pelo DashboardProvider, nenhuma
// query nova.
//
// Dismiss é LOCAL e PERSISTENTE, sem re-nag: "Agora não" grava uma flag via
// `webStorageAdapter` (abstração de storage do projeto, H3.1 — nunca localStorage cru
// quando a abstração existe) e o card some para sempre, mesmo que o gatilho continue
// verdadeiro em sessões futuras.
//
// AP-270: dia local de cada dose derivado com `getUserTime`/`formatLocalDate`
// (@utils/dateUtils) — nunca `toISOString().split('T')[0]` (joga a dose da noite pro dia
// seguinte em GMT-3).

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDashboard } from './useDashboardContext'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { webStorageAdapter } from '@shared/platform/storage/webStorageAdapter'
import { evaluateStockUpsell } from '@dosiq/core'
import { formatLocalDate, getUserTime, parseISO, getTodayLocal } from '@utils/dateUtils'
import { trackStockUpsellShown, trackStockUpsellDismissed } from '@features/settings/services/stockPreferenceService'

const DISMISS_KEY = 'dosiq:stock-upsell-dismissed'

// Guarda de módulo: `trackStockUpsellShown()` dispara UMA vez por sessão de app, não a
// cada remount do hook (navegação embora e volta ao dashboard não deve re-contar).
let hasTrackedShownThisSession = false

type UseStockUpsellResult = {
  visible: boolean
  dismiss: () => void
}

export function useStockUpsell(): UseStockUpsellResult {
  // 1. States
  const [dismissed, setDismissed] = useState<boolean | null>(null) // null = storage ainda não lido

  // 2. Context
  const { enabled, ready } = useStockTracking()
  const { logs, timezone } = useDashboard()

  // 3. Memos
  const loggedDays = useMemo(
    () =>
      (logs || [])
        .map((log) => log?.taken_at)
        .filter(Boolean)
        .map((takenAt) => formatLocalDate(getUserTime(parseISO(takenAt), timezone))),
    [logs, timezone]
  )

  const evaluation = useMemo(
    () => evaluateStockUpsell(loggedDays, getTodayLocal(timezone)),
    [loggedDays, timezone]
  )

  // `ready` evita piscar: enquanto não sabemos a preferência/dismiss, não decide nada.
  const visible = ready && dismissed === false && !enabled && evaluation.eligible

  // 4. Effects
  useEffect(() => {
    let cancelled = false
    webStorageAdapter.getItem(DISMISS_KEY).then((raw) => {
      if (!cancelled) setDismissed(raw === '1')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!visible || hasTrackedShownThisSession) return
    hasTrackedShownThisSession = true
    trackStockUpsellShown()
  }, [visible])

  // 5. Handlers
  const dismiss = useCallback(() => {
    setDismissed(true)
    trackStockUpsellDismissed()
    void webStorageAdapter.setItem(DISMISS_KEY, '1')
  }, [])

  return { visible, dismiss }
}
