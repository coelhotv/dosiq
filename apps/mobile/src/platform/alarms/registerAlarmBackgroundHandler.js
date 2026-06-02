// registerAlarmBackgroundHandler.js — handler de background do Notifee (Spec 001)
//
// DEVE ser registrado no top-level do entrypoint (index.js), antes do app montar
// (requisito do Notifee: onBackgroundEvent precisa existir quando o SO entrega o
// evento com o app morto/background). Sem isso, "Tomei"/"Pular" da lock screen
// (app fechado) não são processados.
//
// Coexiste com expo-notifications: o Notifee só dispara este handler p/ as SUAS
// notificações (canal dose-alarm); push remoto segue pelo handler do Expo.

import notifee, { EventType } from '@notifee/react-native'
import { handleAlarmAction } from './quickDoseRegistration'

let registered = false

export function registerAlarmBackgroundHandler() {
  if (registered) return
  registered = true

  notifee.onBackgroundEvent(async (event) => {
    const { type } = event
    if (type === EventType.ACTION_PRESS || type === EventType.DISMISSED) {
      try {
        await handleAlarmAction(event)
      } catch (err) {
        // best-effort — não relançar no handler de background
        if (__DEV__) console.warn('[alarm-bg] handleAlarmAction falhou', err?.message)
      }
    }
  })
}
