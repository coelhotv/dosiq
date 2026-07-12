// useStockToggle (web) — espelho do hook mobile: máquina de estados do toggle "Controle de
// estoque" (spec 044, F4a / PO-5). MESMA preferência global, MESMO serviço do core — a web e o
// mobile não podem divergir (senão uma consome FIFO e a outra não: corrupção, classe AP-231).
//
// Invariante: OPT-OUT SEMPRE CONGELA (zero mutação de saldo/compras). Único caminho que muta
// estoque = "começar do zero" da reconciliação (adjustment append-only, R-226), por escolha
// explícita do usuário.
//
// ⚠️ AP-281: toda escrita da preferência chama `refresh()` do provider — senão as superfícies
// de estoque (sidebar, cards, export) continuam contradizendo a escolha até dar reload.
// R-010: States → Memos → Effects → Handlers.

import { useCallback, useMemo, useState } from 'react'
import {
  createProfileRepository,
  createStockRepository,
  createStockResumeService,
} from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'
import { useStockTracking } from '@shared/hooks/useStockTracking'

const profileRepo = createProfileRepository({ client: supabase, getUserId })
const stockRepo = createStockRepository({ client: supabase, getUserId })
const resumeService = createStockResumeService({ profileRepo, stockRepo })

export type StockToggleSheet = null | 'freeze' | 'reconcile'

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
      await resumeService.resumeAsIs()
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
      await resumeService.resumeAndZero()
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
      await profileRepo.setStockTracking(false) // carimba stock_paused_at; zero mutação de saldo
      await refresh() // AP-281
      setSheet(null)
      setAnnouncement('Controle de estoque desativado · seu saldo ficou guardado como estava')
    } catch (err) {
      setError((err as Error)?.message ?? 'Erro ao desativar o controle de estoque')
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const requestToggle = useCallback(() => {
    if (busy || !ready) return
    setError(null)
    if (enabled) {
      setSheet('freeze')
      return
    }
    void (async () => {
      setBusy(true)
      try {
        // Só leitura: decide entre retomada silenciosa e reconciliação ANTES de escrever.
        const assessment = await resumeService.assessResume()
        if (assessment.needsReconciliation && assessment.gapDays !== null) {
          setReconcile({ gapDays: assessment.gapDays, pausedAt: assessment.pausedAt })
          setSheet('reconcile')
          return
        }
        await resumeService.resumeAsIs()
        await refresh() // AP-281
        setAnnouncement('Controle de estoque reativado · saldo retomado como estava')
      } catch (err) {
        setError((err as Error)?.message ?? 'Erro ao reativar o controle de estoque')
      } finally {
        setBusy(false)
      }
    })()
  }, [busy, ready, enabled, refresh])

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
  }
}
