// useAlarmEnabled.js — estado reativo do toggle do alarme (Spec 001, FR-007)
//
// AsyncStorage não é reativo: o toggle nas Preferências precisa propagar ao
// scheduler do app root (useAlarmScheduler) sem prop drilling. Mini-store com
// pub/sub: o toggle chama setEnabled → todos os hooks montados re-renderizam.

import { useState, useEffect, useCallback } from 'react'
import { isAlarmEnabled as readPref, setAlarmEnabled as writePref } from './alarmEnabledStore'

let current = false // default OFF (opt-in)
let hydrated = false
const listeners = new Set()

function emit() {
  for (const l of listeners) l(current)
}

/** Carrega o valor persistido uma vez (idempotente). */
async function hydrate() {
  if (hydrated) return
  hydrated = true
  current = await readPref()
  emit()
}

/**
 * Hook reativo: `[enabled, setEnabled]`. Persiste e propaga a todos os assinantes.
 * @returns {[boolean, (v: boolean) => Promise<void>]}
 */
export function useAlarmEnabled() {
  const [enabled, setLocal] = useState(current)

  useEffect(() => {
    const listener = (v) => setLocal(v)
    listeners.add(listener)
    hydrate()
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const setEnabled = useCallback(async (v) => {
    current = v
    emit()
    await writePref(v)
  }, [])

  return [enabled, setEnabled]
}
