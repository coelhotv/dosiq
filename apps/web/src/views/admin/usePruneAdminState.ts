// apps/web/src/views/admin/usePruneAdminState.ts
// Estado da tela "Exclusões pendentes" (spec 107 US-1).
//
// A tela NÃO decide nada: a confirmação por prefixo só habilita o botão — quem confere é o servidor
// (S-2). Toda ação recarrega a lista do servidor, em vez de editar a linha localmente, porque o
// estado de verdade (janela, gate, onda 2) é calculado lá.

import { useState, useEffect, useCallback, startTransition } from 'react'
import { pruneAdminService } from '@services/api/pruneAdminService'

/** Prefixo mínimo para habilitar "Apagar" (espelha APPROVE_PREFIX_MIN do handler). */
export const PRUNE_PREFIX_MIN = 6

/** O prefixo digitado bate com o id da conta? Só habilita o botão — o servidor confere de novo. */
export function prefixMatches(typed: string, userIdShort: string): boolean {
  const t = typed.trim().toLowerCase()
  return t.length >= PRUNE_PREFIX_MIN && userIdShort.toLowerCase().startsWith(t)
}

export function usePruneAdminState() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<{
    approved_waiting: number
    executed_30d: number
    by_section?: Record<string, number>
  } | null>(null)
  const [wave2, setWave2] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const load = useCallback(async (which: 'pending' | 'history') => {
    setIsLoading(true)
    setError(null)
    try {
      const body = await pruneAdminService.list(which)
      setItems(body.data ?? [])
      setSummary(body.summary ?? null)
      setWave2(body.wave2 ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      load(tab)
    })
  }, [load, tab])

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>, success: string) => {
      setBusy(key)
      setMessage(null)
      try {
        await action()
        setMessage({ type: 'success', text: success })
        await load(tab)
        return true
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message })
        return false
      } finally {
        setBusy(null)
      }
    },
    [load, tab]
  )

  const approve = useCallback(
    (queueId: string, prefix: string) => run(queueId, () => pruneAdminService.approve(queueId, prefix), 'Exclusão aprovada. Executa no próximo ciclo das 21:25.'),
    [run]
  )

  const defer = useCallback(
    (queueId: string, note: string, reevaluateAt: string) =>
      run(queueId, () => pruneAdminService.defer(queueId, note, reevaluateAt), 'Decisão adiada.'),
    [run]
  )

  const reveal = useCallback(async (key: string, target: { queueId?: string; userId?: string }, milestone: 'd60' | 'd83' | 'wave2' | 'reaviso') => {
    setBusy(key)
    setMessage(null)
    try {
      const body: any = await pruneAdminService.reveal(target, milestone)
      setRevealed((prev) => ({ ...prev, [key]: body.data.email }))
      return body.data.email as string
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
      return null
    } finally {
      setBusy(null)
    }
  }, [])

  // Mensagem de uma ação não sobrevive à troca de aba (smoke 107: "aprovada" ficou no Histórico).
  const changeTab = useCallback((next: 'pending' | 'history') => {
    setMessage(null)
    setTab(next)
  }, [])

  const markNotice = useCallback(
    (key: string, target: { queueId?: string; userId?: string }, milestone: 'd60' | 'd83' | 'wave2' | 'reaviso') =>
      run(key, () => pruneAdminService.markNotice(target, milestone), 'Aviso marcado como enviado.'),
    [run]
  )

  return { tab, setTab: changeTab, items, summary, wave2, isLoading, error, busy, message, revealed, reload: () => load(tab), approve, defer, reveal, markNotice }
}
