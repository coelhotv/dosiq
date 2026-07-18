// useTitrationTimeline.ts — carrega a escada de um tratamento para a timeline (spec 029 F4 / T020).
// Lê via titrationService.getLadderForProtocol (fetch próprio com join de medicines — o embed do
// protocolo não traz nome nem intake_unit). Refetch on focus (a escada muda no cadastro/edição).

import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { getLadderForProtocol, type LadderStepWithMedicine } from '../services/titrationService'

export function useTitrationTimeline(protocolId: string | null | undefined) {
  const [steps, setSteps] = useState<LadderStepWithMedicine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Guarda de corrida: o refresh-on-focus pode sobrepor o load do mount (ou uma troca de
  // protocolId). Sem isto, a resposta MAIS VELHA pode chegar depois e sobrescrever a mais nova —
  // a timeline mostraria escada obsoleta (dado clínico). Só a requisição corrente aplica estado.
  const reqIdRef = useRef(0)

  const load = useCallback(async () => {
    const myReq = ++reqIdRef.current
    if (!protocolId) {
      if (myReq === reqIdRef.current) {
        setSteps([])
        setLoading(false)
      }
      return
    }
    setLoading(true)
    try {
      const data = await getLadderForProtocol(protocolId)
      if (myReq !== reqIdRef.current) return // resposta obsoleta — descarta
      setSteps(data)
      setError(null)
    } catch (err: any) {
      if (myReq !== reqIdRef.current) return
      setError(err?.message ?? 'Erro ao carregar a evolução do tratamento.')
      setSteps([])
    } finally {
      if (myReq === reqIdRef.current) setLoading(false)
    }
  }, [protocolId])

  // startTransition marca os updates do load como transição — evita o warning de
  // setState síncrono dentro do efeito (cascading renders).
  useEffect(() => {
    startTransition(() => {
      load().catch(() => {})
    })
  }, [load])

  return { steps, loading, error, refresh: load, hasLadder: steps.length > 0 }
}
