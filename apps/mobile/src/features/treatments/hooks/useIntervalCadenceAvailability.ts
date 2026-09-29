import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { fetchIntervalCadenceAvailability } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'

/** Teto de espera pela trava antes de desenhar as opções sem ela (086 FR-022 / RC2 D-8). */
export const CADENCE_GATE_TIMEOUT_MS = 1500

export interface IntervalCadenceAvailability {
  /** A cadência "a cada N dias" (e "Mensal") pode ser oferecida a esta usuária. */
  available: boolean
  /** Já há resposta — ou o teto passou. Antes disso quem desenha opções mostra esqueleto. */
  settled: boolean
}

/**
 * A cadência "a cada N dias" pode ser oferecida a esta usuária? (085 C2 — trava por usuária)
 *
 * Mesmo neste app atualizado a resposta pode ser `false`: basta outro aparelho DELA com versão
 * antiga — é ele que trataria a cadência como diária. Começa `false`; erro também é `false`.
 *
 * 086 (RC3 E-3): tri-estado. `settled` vira `true` com a resposta ou após o teto de 1,5 s (lado
 * seguro: segue sem a opção). Resposta que chega DEPOIS do teto não é aplicada na hora — o salto de
 * layout com a tela já desenhada é o que o D-8 quer evitar —, fica guardada e vale no próximo foco,
 * quando a trava também é consultada de novo (o heartbeat do aparelho pode ter gravado entretanto — U-1).
 */
export function useIntervalCadenceAvailability(): IntervalCadenceAvailability {
  const [state, setState] = useState<IntervalCadenceAvailability>({ available: false, settled: false })
  const lateAnswerRef = useRef<boolean | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      let timedOut = false

      if (lateAnswerRef.current !== null) {
        const late = lateAnswerRef.current
        lateAnswerRef.current = null
        setState({ available: late, settled: true })
      }

      const timer = setTimeout(() => {
        timedOut = true
        if (!cancelled) setState((prev) => (prev.settled ? prev : { available: false, settled: true }))
      }, CADENCE_GATE_TIMEOUT_MS)

      supabase.auth
        .getUser()
        // `as never`: o mobile resolve uma cópia própria do supabase-js — mesmo padrão de
        // createConsentService (platform/consent/useConsentGate.tsx).
        .then(({ data }) => fetchIntervalCadenceAvailability(supabase as never, data?.user?.id ?? null))
        .catch(() => false)
        .then((ok) => {
          if (cancelled) return
          clearTimeout(timer)
          if (timedOut) lateAnswerRef.current = ok
          else setState({ available: ok, settled: true })
        })

      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [])
  )

  return state
}
