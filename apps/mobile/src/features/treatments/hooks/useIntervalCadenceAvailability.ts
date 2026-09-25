import { useEffect, useState } from 'react'
import { fetchIntervalCadenceAvailability } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'

/**
 * A cadência "a cada N dias" pode ser oferecida a esta usuária? (085 C2 — trava por usuária)
 *
 * Mesmo neste app atualizado a resposta pode ser `false`: basta outro aparelho DELA com versão
 * antiga — é ele que trataria a cadência como diária. Começa `false`; erro também é `false`.
 */
export function useIntervalCadenceAvailability(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth
      .getUser()
      // `as never`: o mobile resolve uma cópia própria do supabase-js — mesmo padrão de
      // createConsentService (platform/consent/useConsentGate.tsx).
      .then(({ data }) => fetchIntervalCadenceAvailability(supabase as never, data?.user?.id ?? null))
      .catch(() => false)
      .then((ok) => {
        if (!cancelled) setAvailable(ok)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return available
}
