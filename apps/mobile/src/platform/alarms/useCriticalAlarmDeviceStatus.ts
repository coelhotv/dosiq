// useCriticalAlarmDeviceStatus — estado do alarme crítico neste aparelho, AO VIVO (054 FR-009).
// Lido na montagem e a cada volta ao foreground (Ajustes muda fora do app; o diálogo do iOS também
// devolve o app a `active`, então a concessão aparece sem refresh manual). Nunca cacheado.

import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { getCriticalAlarmDeviceStatus, type CriticalAlarmDeviceStatus } from './alarmService'

export function useCriticalAlarmDeviceStatus(enabled = true) {
  const [status, setStatus] = useState<CriticalAlarmDeviceStatus>({ kind: 'unknown' })

  const refresh = useCallback(async () => {
    setStatus(await getCriticalAlarmDeviceStatus())
  }, [])

  useEffect(() => {
    if (!enabled) return
    // refresh é async — setState pós-await (leitura do SO na montagem).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh()
    })
    return () => sub.remove()
  }, [enabled, refresh])

  return { status, refresh }
}
