// devAlarmTriggers.js — gatilhos DEV-only pra smoke do Alarme Nativo (Spec 001).
//
// NÃO usar em produção. Constrói o MESMO payload do alarmService.buildNotification
// (título/corpo/som/ações/categoria) pra inspeção visual da notificação e do path
// full-screen sem esperar uma dose real. Usa um doseInstanceId sentinela —
// Tomei/Pular vão falhar no registro (id inexistente no DB) de propósito; o foco
// é a APRESENTAÇÃO (notif, botões, takeover, loop de som, soneca).

import notifee, {
  AndroidImportance,
  AndroidCategory,
  TriggerType,
} from '@notifee/react-native'
import {
  ALARM_CHANNEL_ID,
  ALARM_ACTION,
  ensureAlarmSetup,
} from '@platform/alarms/alarmService'

const DEV_INSTANCE_ID = 'dev-test-alarm'
const DEV_MEDICINE = 'Afrezza (teste)'

// Espelha o bloco produzido por buildNotification (alarmService), simplificado.
function buildDevNotification(notificationId) {
  return {
    id: notificationId,
    title: '💊 Hora da dose',
    body: `Está na hora de tomar ${DEV_MEDICINE} (13:13).`,
    data: {
      doseInstanceId: DEV_INSTANCE_ID,
      medicineName: DEV_MEDICINE,
      scheduledTime: '13:13',
      snoozeAttempt: '0',
      __dev: 'true',
    },
    android: {
      channelId: ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      sound: 'alarm_dose',
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Tomei', pressAction: { id: ALARM_ACTION.TAKEN } },
        { title: 'Soneca', pressAction: { id: ALARM_ACTION.SNOOZE } },
        { title: 'Pular', pressAction: { id: ALARM_ACTION.SKIP } },
      ],
    },
    ios: {
      sound: 'alarm_dose.wav',
      interruptionLevel: 'timeSensitive',
      categoryId: ALARM_CHANNEL_ID,
      foregroundPresentationOptions: { sound: true, banner: true, list: true },
    },
  }
}

// INVARIANTE A (alarmService): notificationId === doseInstanceId, senão
// cancelAlarm(doseInstanceId) não casa a notif exibida e o som não para.
/** Mostra a notificação NA HORA (visual rápido: notif + botões + som). */
export async function devFireAlarmNow() {
  await ensureAlarmSetup()
  await notifee.displayNotification(buildDevNotification(DEV_INSTANCE_ID))
}

/** Agenda pra +Ns (path real do trigger: Doze/lock → full-screen → ações). */
export async function devScheduleAlarmIn(seconds = 10) {
  await ensureAlarmSetup()
  await notifee.createTriggerNotification(buildDevNotification(DEV_INSTANCE_ID), {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + seconds * 1000,
    alarmManager: { allowWhileIdle: true },
  })
}

/** Limpa o alarme de teste pendente/exibido. */
export async function devClearAlarms() {
  await notifee.cancelNotification(DEV_INSTANCE_ID)
  await notifee.cancelTriggerNotification(DEV_INSTANCE_ID)
}
