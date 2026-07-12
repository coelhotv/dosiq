// useStockToggle — máquina de estados do toggle "Controle de estoque" (spec 044, F4a / PO-5).
//
// Invariante desta fase: OPT-OUT SEMPRE CONGELA. Zero mutação de saldo/compras; o único
// caminho que muta estoque é o "começar do zero" da reconciliação (adjustment append-only
// `legacy_unrecoverable`, R-226), e só quando o usuário escolhe.
//
// Transições (o serviço do core faz as escritas — aqui só a orquestração da UI):
//   ON  → toggle  → sheet 'freeze' → [Desativar] setStockTracking(false) (carimba stock_paused_at)
//   OFF → toggle  → assessResume() (SÓ LEITURA)
//                     gap < 30d ou sem carimbo → resumeAsIs() silencioso + toast textual
//                     gap >= 30d               → sheet 'reconcile' (NENHUMA escrita ainda)
//                        [Começar do zero]   → resumeAndZero()
//                        [Retomar o saldo]   → resumeAsIs()
//                        fechar sem decidir  → nada é escrito; segue OFF; reaparece na próxima
//
// ⚠️ AP-281: toda escrita da preferência chama `refresh()` do provider ANTES de concluir —
// senão as superfícies de estoque continuam contradizendo a escolha até o app recarregar.
// R-010: States → Memos → Effects → Handlers.

import { useCallback, useMemo, useState } from 'react'
import {
  createProfileRepository,
  createStockRepository,
  createStockResumeService,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { useStockTracking } from '@shared/hooks/useStockTracking'

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

const profileRepo = createProfileRepository({ client: supabase as never, getUserId })
const stockRepo = createStockRepository({ client: supabase as never, getUserId })
const resumeService = createStockResumeService({ profileRepo, stockRepo })

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
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Memos
  const neverHadStock = useMemo(() => !enabled && !pausedAt, [enabled, pausedAt])

  // Handlers
  const clearAnnouncement = useCallback(() => setAnnouncement(null), [])

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

  /** "Começar do zero": zera por medicamento (append-only) e só então liga a preferência. */
  const resumeAndZero = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await resumeService.resumeAndZero()
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
      await profileRepo.setStockTracking(false)
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
    // OFF → ON: avalia o gap ANTES de escrever (assessResume só lê).
    void (async () => {
      setBusy(true)
      try {
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
