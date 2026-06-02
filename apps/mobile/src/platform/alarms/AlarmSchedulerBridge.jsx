// AlarmSchedulerBridge.jsx — cola o scheduler de alarmes ao app root (Spec 001)
//
// Monta-se uma vez na árvore. Quando o alarme está ligado (FR-007), carrega
// protocolos ativos + tz do usuário e alimenta useAlarmScheduler (reuso CON-024).
// Também registra o handler de FOREGROUND do Notifee (o de background fica no
// index.js). Render nulo — é só orquestração.
//
// Coexiste com expo-notifications: só trata eventos das notificações do Notifee.

import { useState, useEffect } from 'react'
import { AppState } from 'react-native'
import notifee, { EventType } from '@notifee/react-native'
import { getRawNow } from '@dosiq/core'
import { useAuth } from '@platform/auth/hooks/useAuth'
import { getActiveProtocols, getUserSettings } from '@dashboard/services/dashboardService'
import { useAlarmEnabled } from './useAlarmEnabled'
import { useAlarmScheduler } from './useAlarmScheduler'
import { handleAlarmAction } from './quickDoseRegistration'

const DEFAULT_TZ = 'America/Sao_Paulo'

export default function AlarmSchedulerBridge() {
  const { user } = useAuth()
  const [enabled] = useAlarmEnabled()
  const [protocols, setProtocols] = useState([])
  const [tz, setTz] = useState(DEFAULT_TZ)
  const userId = user?.id ?? null

  // Foreground: processa "Tomei"/"Pular" quando o app está aberto.
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(async (event) => {
      if (event.type === EventType.ACTION_PRESS) {
        try {
          await handleAlarmAction(event)
        } catch (err) {
          if (__DEV__) console.warn('[AlarmSchedulerBridge] foreground action falhou', err?.message)
        }
      }
    })
    return unsub
  }, [])

  // Carrega protocolos + tz quando ligado (mount + retorno de background).
  // Desligado → não carrega; useAlarmScheduler cancela via isAlarmEnabled=false
  // (sem reset de estado aqui — evita set-state-in-effect).
  useEffect(() => {
    if (!enabled || !userId) return
    let active = true

    async function load() {
      try {
        const settings = await getUserSettings(userId)
        const userTz = settings?.timezone || DEFAULT_TZ
        // YYYY-MM-DD no fuso do usuário (en-CA → ISO date), sem dep extra.
        const dateStr = getRawNow().toLocaleDateString('en-CA', { timeZone: userTz })
        const protos = await getActiveProtocols(userId, dateStr)
        if (!active) return
        setTz(userTz)
        setProtocols(Array.isArray(protos) ? protos : [])
      } catch (err) {
        if (__DEV__) console.warn('[AlarmSchedulerBridge] load falhou', err?.message)
      }
    }

    load()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load()
    })
    return () => {
      active = false
      sub.remove()
    }
  }, [enabled, userId])

  useAlarmScheduler({ isAlarmEnabled: enabled, userId, protocols, tz })
  return null
}
