// useStockToggle (web) — espelho do hook mobile: máquina de estados do toggle "Controle de
// estoque" (spec 044, F4a/F4b / PO-5). MESMA preferência global, MESMO serviço do core — a web e
// o mobile não podem divergir (senão uma consome FIFO e a outra não: corrupção, classe AP-231).
//
// Invariante: OPT-OUT SEMPRE CONGELA (zero mutação de saldo/compras). Único caminho que muta
// estoque = "começar do zero" da reconciliação (adjustment append-only, R-226) ou o saldo
// inicial (T017), por escolha explícita do usuário.
//
// T017/T019: toda escrita passa por `stockPreferenceService` — é a origem comum que garante o
// analytics do opt-in. Este hook NUNCA chama profileRepo/createStockResumeService direto.
//
// ⚠️ AP-281: toda escrita da preferência chama `refresh()` do provider — senão as superfícies
// de estoque (sidebar, cards, export) continuam contradizendo a escolha até dar reload.
// R-010: States → Memos → Effects → Handlers.

import { useCallback, useMemo, useState } from 'react'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import {
  assessStockResume,
  disableStockTracking,
  resumeStockAndZero,
  resumeStockAsIs,
} from '@features/settings/services/stockPreferenceService'

export type StockToggleSheet = null | 'freeze' | 'reconcile' | 'initial-balance'

export interface StockToggleReconcile {
  gapDays: number
  pausedAt: string | null
}

export function useStockToggle() {
  // States
  const { enabled, pausedAt, ready, refresh } = useStockTracking()
  const [sheet, setSheet] = useState<StockToggleSheet>(null)
  const [reconcile, setReconcile] = useState<StockToggleReconcile | null>(null)
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Memos
  const neverHadStock = useMemo(() => !enabled && !pausedAt, [enabled, pausedAt])

  // Handlers
  const clearAnnouncement = useCallback(() => setAnnouncement(null), [])

  const closeSheet = useCallback(() => {
    // Fechar sem decidir NÃO ativa: nada é escrito, a preferência continua OFF.
    setSheet(null)
    setReconcile(null)
    // O erro é da tentativa abandonada: na web ele fica renderizado abaixo do toggle, então
    // deixá-lo vivo mostraria a falha de uma ação que o usuário já desistiu de fazer.
    setError(null)
  }, [])

  const resumeAsIs = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await resumeStockAsIs('settings')
      await refresh() // AP-281
      setSheet(null)
      setReconcile(null)
      setAnnouncement('Controle de estoque reativado · saldo retomado como estava')
    } catch (err) {
      setError((err as Error)?.message ?? 'Erro ao reativar o controle de estoque')
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const resumeAndZero = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      // Zera por medicamento (append-only) e só então liga a preferência: falha no meio
      // deixa o controle OFF e o sheet reaparece — nunca religa o FIFO sobre saldo parcial.
      await resumeStockAndZero('settings')
      await refresh() // AP-281
      setSheet(null)
      setReconcile(null)
      setAnnouncement('Controle de estoque reativado · saldo zerado, histórico de compras preservado')
    } catch (err) {
      setError((err as Error)?.message ?? 'Erro ao reativar o controle de estoque')
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const confirmFreeze = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await disableStockTracking('settings') // carimba stock_paused_at; zero mutação de saldo
      await refresh() // AP-281
      setSheet(null)
      setAnnouncement('Controle de estoque desativado · seu saldo ficou guardado como estava')
    } catch (err) {
      setError((err as Error)?.message ?? 'Erro ao desativar o controle de estoque')
    } finally {
      setBusy(false)
    }
  }, [refresh])

  // T017: quem nunca teve estoque (off e sem stock_paused_at) não ativa direto — abre o form
  // de saldo inicial. A escrita real (saldos + liga a preferência) só acontece lá.
  const closeInitialBalance = useCallback(() => {
    setSheet(null)
  }, [])

  const finishInitialBalance = useCallback(async () => {
    await refresh() // AP-281 — activateStockWithInitialBalance já escreveu
    setSheet(null)
    setAnnouncement('Controle de estoque ativado')
  }, [refresh])

  const requestToggle = useCallback(() => {
    if (busy || !ready) return
    setError(null)
    if (enabled) {
      setSheet('freeze')
      return
    }
    if (neverHadStock) {
      setSheet('initial-balance')
      return
    }
    void (async () => {
      setBusy(true)
      try {
        // Só leitura: decide entre retomada silenciosa e reconciliação ANTES de escrever.
        const assessment = await assessStockResume()
        // Carimbo SEM saldo por trás (legado, ou opt-out com o estoque já vazio): não há o que
        // retomar — retomar "as-is" ligaria o FIFO sobre zero e pularia a pergunta do saldo
        // inicial. Trata como quem nunca teve estoque (PO-3).
        if (!assessment.hasFrozenBalance) {
          setSheet('initial-balance')
          return
        }
        if (assessment.needsReconciliation && assessment.gapDays !== null) {
          setReconcile({ gapDays: assessment.gapDays, pausedAt: assessment.pausedAt })
          setSheet('reconcile')
          return
        }
        await resumeStockAsIs('settings')
        await refresh() // AP-281
        setAnnouncement('Controle de estoque reativado · saldo retomado como estava')
      } catch (err) {
        setError((err as Error)?.message ?? 'Erro ao reativar o controle de estoque')
      } finally {
        setBusy(false)
      }
    })()
  }, [busy, ready, enabled, neverHadStock, refresh])

  return {
    enabled,
    ready,
    neverHadStock,
    sheet,
    reconcile,
    busy,
    announcement,
    clearAnnouncement,
    error,
    requestToggle,
    confirmFreeze,
    resumeAsIs,
    resumeAndZero,
    closeSheet,
    closeInitialBalance,
    finishInitialBalance,
  }
}
