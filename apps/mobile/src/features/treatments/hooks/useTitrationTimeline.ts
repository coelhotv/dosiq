// useTitrationTimeline.ts — carrega a escada de um tratamento para a timeline (spec 029 F4 / T020).
// Lê via titrationService.getLadderForProtocol (fetch próprio com join de medicines — o embed do
// protocolo não traz nome nem intake_unit). Refetch on focus (a escada muda no cadastro/edição).

import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { getLadderForProtocol, getUserTimezone, type LadderStepWithMedicine } from '../services/titrationService'

export function useTitrationTimeline(protocolId: string | null | undefined) {
  const [steps, setSteps] = useState<LadderStepWithMedicine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Fuso do DONO, não o do device (R-253/R-254). O vencimento da etapa é dia de calendário LOCAL,
  // e o Hoje (usePendingSwitch) já usa o fuso real — sem isto a MESMA pendência renderizaria
  // "aguardando desde" e contagem de dias DIFERENTES nas duas telas para quem não está em SP
  // (achado do RC6). Fallback idêntico ao resolveUserTz.
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
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
      // Best-effort: fuso indisponível cai no fallback e a escada ainda carrega (R-245).
      const [data, tz] = await Promise.all([
        getLadderForProtocol(protocolId),
        getUserTimezone().catch(() => 'America/Sao_Paulo'),
      ])
      if (myReq !== reqIdRef.current) return // resposta obsoleta — descarta
      setSteps(data)
      setTimezone(tz)
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

  return { steps, loading, error, timezone, refresh: load, hasLadder: steps.length > 0 }
}
