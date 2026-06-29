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

// Ação do alarme (Tomei/Pular/soneca da superfície). Lazy-require (cold start leve, AP-205).
async function onActionOrDismiss(event) {
  try {
    const { handleAlarmAction } = require('./quickDoseRegistration')
    await handleAlarmAction(event)
  } catch (err) {
    if (__DEV__) console.warn('[alarm-bg] handleAlarmAction falhou', err?.message)
  }
}

// Entrega de notificação (boundary da superfície 039 F2 trigger-driven): __surface → agenda o
// próximo boundary (encadeamento headless); __surfaceEnd → encerra no missed. DEV: encadeia o spike.
async function onDelivered(data) {
  try {
    if (data?.__surface === 'true') {
      const { advanceDoseActivity } = require('../doseActivity/doseActivityScheduler')
      await advanceDoseActivity(data)
    } else if (data?.__surfaceEnd === 'true') {
      const { endDoseActivity } = require('../doseActivity/doseActivitySurfaceService')
      await endDoseActivity(data.doseInstanceId)
    } else if (data?.doseInstanceId) {
      // Alarme entregue (não-superfície): marca-passo confiável → reconcilia a superfície da dose
      // (mantém a cadeia viva atravessando T0/soneca, onde a race do fullScreen droparia o boundary).
      const { reconcileDoseActivityFromAlarm } = require('../doseActivity/doseActivityScheduler')
      await reconcileDoseActivityFromAlarm(data)
    }
  } catch (err) {
    if (__DEV__) console.warn('[alarm-bg] surface advance falhou', err?.message)
  }
  if (__DEV__) {
    try {
      const { onSpikeDelivered } = require('../../features/_dev/devDoseActivityBgSpike')
      await onSpikeDelivered(data)
    } catch (err) {
      if (__DEV__) console.warn('[alarm-bg] spike chain falhou', err?.message)
    }
  }
}

export function registerAlarmBackgroundHandler() {
  if (registered) return
  registered = true

  // IMPORTANTE: NÃO importar quickDoseRegistration/scheduler no topo. Isso é chamado no entrypoint
  // (index.js) antes do AppRegistry; importar a cadeia pesada (doseService → supabase + firebase) no
  // cold start, antes dos módulos nativos inicializarem, crasha o app no launch (emulador Android API
  // 30). Lazy-require dentro do callback mantém o cold start leve.
  notifee.onBackgroundEvent(async (event) => {
    const type = event?.type
    if (type === EventType.ACTION_PRESS || type === EventType.DISMISSED) {
      await onActionOrDismiss(event)
    } else if (type === EventType.DELIVERED) {
      await onDelivered(event?.detail?.notification?.data)
    }
  })
}
