// useStockToggle — máquina de estados do toggle "Controle de estoque" (spec 044, F4a/F4b — PO-5/PO-3).
//
// Invariante desta fase: OPT-OUT SEMPRE CONGELA. Zero mutação de saldo/compras; o único
// caminho que muta estoque é o "começar do zero" da reconciliação (adjustment append-only
// `legacy_unrecoverable`, R-226), e só quando o usuário escolhe.
//
// Transições (o service do core faz as escritas — aqui só a orquestração da UI):
//   ON  → toggle  → sheet 'freeze' → [Desativar] disableStockTracking() (carimba stock_paused_at)
//   OFF → toggle  → neverHadStock (nasceu dose-only, sem carimbo de congelamento)?
//                     SIM → needsInitialBalance=true (SEM escrita) — a UI abre a tela de saldo
//                           inicial (F4b/T017); quem grava é activateStockWithInitialBalance,
//                           não este hook.
//                     NÃO → assessStockResume() (SÓ LEITURA) — fluxo F4a intacto:
//                            gap < 30d ou sem carimbo → resumeStockAsIs() silencioso + toast
//                            gap >= 30d               → sheet 'reconcile' (NENHUMA escrita ainda)
//                               [Começar do zero]   → resumeStockAndZero()
//                               [Retomar o saldo]   → resumeStockAsIs()
//                               fechar sem decidir  → nada é escrito; segue OFF; reaparece depois
//
// ⚠️ AP-281: toda escrita da preferência chama `refresh()` do provider ANTES de concluir —
// senão as superfícies de estoque continuam contradizendo a escolha até o app recarregar.
// R-010: States → Memos → Effects → Handlers.

import { useCallback, useMemo, useState } from 'react'
import {
  disableStockTracking,
  resumeStockAsIs,
  resumeStockAndZero,
  assessStockResume,
} from '@profile/services/stockPreferenceService'
import { useStockTracking } from '@shared/hooks/useStockTracking'

/** Sheet aberto no momento (null = nenhum). */
export type StockToggleSheet = null | 'freeze' | 'reconcile'

export interface StockToggleReconcile {
  /** Dias inteiros de congelamento (>= STOCK_RESUME_RECONCILE_DAYS). */
  gapDays: number
  /** Carimbo do opt-out (ISO) — alimenta "Retomar o saldo de {data}". */
  pausedAt: string | null
}

export interface UseStockToggle {
  enabled: boolean
  ready: boolean
  /** Nunca teve estoque: off e sem carimbo de congelamento (jamais desativou — nasceu dose-only). */
  neverHadStock: boolean
  sheet: StockToggleSheet
  reconcile: StockToggleReconcile | null
  busy: boolean
  /** Sinaliza que a UI deve abrir StockInitialBalanceScreen (F4b/T017) — zero escrita até lá. */
  needsInitialBalance: boolean
  /** Consome o sinal acima (a UI chama depois de navegar, pra não reabrir em loop). */
  acknowledgeInitialBalanceRequest: () => void
  /** Mensagem de sucesso a anunciar por TEXTO (toast/live region) — a11y §10 do design. */
  announcement: string | null
  clearAnnouncement: () => void
  error: string | null
  requestToggle: () => void
  confirmFreeze: () => Promise<void>
  resumeAsIs: () => Promise<void>
  resumeAndZero: () => Promise<void>
  /** Fechar sem decidir: NÃO ativa. Zero escrita. */
  closeSheet: () => void
}

export function useStockToggle(): UseStockToggle {
  // States
  const { enabled, pausedAt, ready, refresh } = useStockTracking()
  const [sheet, setSheet] = useState<StockToggleSheet>(null)
  const [reconcile, setReconcile] = useState<StockToggleReconcile | null>(null)
  const [busy, setBusy] = useState(false)
  const [needsInitialBalance, setNeedsInitialBalance] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Memos
  const neverHadStock = useMemo(() => !enabled && !pausedAt, [enabled, pausedAt])

  // Handlers
  const clearAnnouncement = useCallback(() => setAnnouncement(null), [])

  const acknowledgeInitialBalanceRequest = useCallback(() => setNeedsInitialBalance(false), [])

  const closeSheet = useCallback(() => {
    // Fechar sem decidir nunca ativa: a preferência no banco continua como está.
    setSheet(null)
    setReconcile(null)
    // O erro pertence à tentativa que acabou de ser abandonada — mantê-lo faria a mensagem
    // ressurgir fora de contexto na próxima interação.
    setError(null)
  }, [])

  /** Liga o estoque retomando o saldo as-is (gap curto ou escolha explícita do usuário). */
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

  /** "Começar do zero": zera por medicamento (append-only) e só então liga a preferência. */
  const resumeAndZero = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await resumeStockAndZero('settings')
      await refresh() // AP-281
      setSheet(null)
      setReconcile(null)
      setAnnouncement('Controle de estoque reativado · saldo zerado, histórico de compras preservado')
    } catch (err) {
      // Falha no meio do zeramento → a preferência continua OFF (o service só liga no fim):
      // o sheet reaparece na próxima tentativa, nunca religa o FIFO sobre saldo meio-zerado.
      setError((err as Error)?.message ?? 'Erro ao reativar o controle de estoque')
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const confirmFreeze = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      // Congela: carimba stock_paused_at. ZERO mutação de saldo/compras.
      await disableStockTracking('settings')
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
    if (neverHadStock) {
      // Nunca teve saldo congelado pra retomar — precisa perguntar o saldo inicial ANTES de
      // ligar o FIFO (PO-3). Zero escrita aqui: quem grava é activateStockWithInitialBalance,
      // disparado pela tela que a UI abre a partir deste sinal.
      setNeedsInitialBalance(true)
      return
    }
    // OFF → ON (já teve estoque antes): avalia o gap ANTES de escrever (assessResume só lê).
    void (async () => {
      setBusy(true)
      try {
        const assessment = await assessStockResume()
        // Carimbo SEM saldo por trás (legado, ou opt-out com o estoque já vazio): não há o que
        // retomar — retomar "as-is" ligaria o FIFO sobre zero e pularia a pergunta do saldo
        // inicial. Trata como quem nunca teve estoque (PO-3).
        if (!assessment.hasFrozenBalance) {
          setNeedsInitialBalance(true)
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
    needsInitialBalance,
    acknowledgeInitialBalanceRequest,
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
