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

let registered = false

export function registerAlarmBackgroundHandler() {
  if (registered) return
  registered = true

  // IMPORTANTE: NÃO importar quickDoseRegistration no topo. Isso é chamado no
  // entrypoint (index.js) antes do AppRegistry; importar a cadeia pesada
  // (doseService → supabase client + firebase analytics) no cold start, antes
  // dos módulos nativos inicializarem, crasha o app no launch (visto no emulador
  // Android API 30). Lazy-require dentro do callback mantém o cold start leve —
  // o handler só roda quando o SO entrega um evento, com o runtime já pronto.
  notifee.onBackgroundEvent(async (event) => {
    const { type } = event
    if (type === EventType.ACTION_PRESS || type === EventType.DISMISSED) {
      try {
        const { handleAlarmAction } = require('./quickDoseRegistration')
        await handleAlarmAction(event)
      } catch (err) {
        // best-effort — não relançar no handler de background
        if (__DEV__) console.warn('[alarm-bg] handleAlarmAction falhou', err?.message)
      }
    }
  })
}
