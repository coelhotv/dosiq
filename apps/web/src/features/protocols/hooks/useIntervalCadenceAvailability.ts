import { useEffect, useState } from 'react'
import { fetchIntervalCadenceAvailability } from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'

/**
 * A cadência "a cada N dias" pode ser oferecida a esta usuária? (085 C2 — trava por usuária)
 *
 * Começa `false` e só vira `true` depois que os aparelhos DELA confirmam o app atualizado:
 * enquanto carrega, ou se a consulta falhar, a opção simplesmente não aparece — lado seguro.
 */
export function useIntervalCadenceAvailability(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    getUserId()
      .then((userId) => fetchIntervalCadenceAvailability(supabase, userId))
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
