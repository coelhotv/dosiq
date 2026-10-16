// useCriticalAlarmDeviceStatus — estado do alarme crítico neste aparelho, AO VIVO (054 FR-009).
// Lido na montagem e a cada volta ao foreground (Ajustes muda fora do app; o diálogo do iOS também
// devolve o app a `active`, então a concessão aparece sem refresh manual). Nunca cacheado.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getCriticalAlarmDeviceStatus, type CriticalAlarmDeviceStatus } from './alarmService'

export function useCriticalAlarmDeviceStatus(enabled = true) {
  const [status, setStatus] = useState<CriticalAlarmDeviceStatus>({ kind: 'unknown' })

  // Leituras concorrentes (montagem, AppState 'active', pós-pedido): só a ÚLTIMA iniciada aplica —
  // senão uma leitura velha que termina depois sobrescreve a concessão recém-feita (RC6 #889).
  const genRef = useRef(0)
  const refresh = useCallback(async () => {
    const gen = ++genRef.current
    const next = await getCriticalAlarmDeviceStatus()
    if (gen === genRef.current) setStatus(next)
  }, [])

  useEffect(() => {
    if (!enabled) return
    // refresh é async — setState pós-await (leitura do SO na montagem).
     
    refresh()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh()
    })
    return () => {
      sub.remove()
      genRef.current++ // desmontado: descarta leituras em voo
    }
  }, [enabled, refresh])

  return { status, refresh }
}
