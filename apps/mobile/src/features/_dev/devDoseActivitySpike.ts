// devDoseActivitySpike.js — spike DEV-only do épico 039 (Dose State Machine).
//
// Prova de feasibility (PO-0.2, FASE 0): ongoing notification persistente com
// CRONÔMETRO vivo (count-down/up) + botões de ação, via Notifee, SEM servidor e
// SEM código nativo novo. Distinto do alarme (devAlarmTriggers): não é alarme
// (sem loopSound, importance DEFAULT), é a "superfície de estado contínuo".
//
// NÃO usar em produção. doseInstanceId sentinela — Registrar/Adiar caem em path
// de DEV (id inexistente no DB); o foco do spike é a APRESENTAÇÃO: a notificação
// fica fixa, o cronômetro corre sozinho (sem update) e os botões aparecem.

import notifee, { AndroidImportance } from '@notifee/react-native'

// Canal próprio do spike — separado do alarme (R-260/R-261: canal imutável; id
// novo p/ não colidir com config do canal de alarme). Sem som (companheiro, não alarme).
const SPIKE_CHANNEL_ID = 'dose-activity-spike'
const SPIKE_INSTANCE_ID = 'dev-dose-activity-spike'
const DEV_MEDICINE = 'Lantus'

// Ações do spike (sentinelas — no MVP mapeiam p/ createDoseLogService/soneca).
const SPIKE_ACTION = {
  REGISTER: 'spike-register',
  SNOOZE: 'spike-snooze',
}

async function ensureSpikeChannel() {
  await notifee.createChannel({
    id: SPIKE_CHANNEL_ID,
    name: 'Dose — estado contínuo (spike)',
    importance: AndroidImportance.DEFAULT, // persistente, não intrusivo (não é alarme)
    sound: undefined,
    vibration: false,
  })
}

// Monta a ongoing notification com cronômetro vivo apontando p/ `targetMs`.
// `countDown=true` → regressivo (estado PRÓXIMA); false → progressivo (PENDENTE/atrasada).
// TODO(040-strict): payload notifee (Notification) não tipado (nível B)
function buildSpikeNotification({ stateLabel, targetMs, countDown }): any {
  return {
    id: SPIKE_INSTANCE_ID,
    title: `${DEV_MEDICINE} · ${stateLabel}`,
    body: countDown ? 'Próxima dose' : 'Dose atrasada',
    data: {
      doseInstanceId: SPIKE_INSTANCE_ID,
      medicineName: DEV_MEDICINE,
      __dev: 'true',
    },
    android: {
      channelId: SPIKE_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT,
      ongoing: true, // fixa (não deslizável)
      autoCancel: false,
      onlyAlertOnce: true, // updates de estado não re-alertam
      // Cronômetro vivo: conta sozinho relativo a `timestamp`, sem update do app.
      showChronometer: true,
      chronometerDirection: countDown ? 'down' : 'up',
      timestamp: targetMs,
      // Spike SEM pressAction de corpo: tocar a notif NÃO abre o app — evita o
      // handler de push existente (usePushNotifications) capturar o press (AP-207)
      // e cair no fallback navigate('Hoje'). Botões também sem launchActivity:
      // são sentinela visual (o registro real vem no MVP via createDoseLogService).
      actions: [
        { title: 'Registrar', pressAction: { id: SPIKE_ACTION.REGISTER } },
        { title: 'Adiar', pressAction: { id: SPIKE_ACTION.SNOOZE } },
      ],
    },
  }
}

/** PRÓXIMA: cronômetro regressivo até daqui a `seconds` (estado upcoming/now). */
export async function devDoseSpikeUpcoming(seconds = 60) {
  await ensureSpikeChannel()
  await notifee.displayNotification(
    buildSpikeNotification({
      stateLabel: 'Em breve',
      targetMs: Date.now() + seconds * 1000,
      countDown: true,
    })
  )
}

/** PENDENTE/atrasada: cronômetro progressivo desde `secondsAgo` atrás (count-up). */
export async function devDoseSpikeLate(secondsAgo = 30) {
  await ensureSpikeChannel()
  await notifee.displayNotification(
    buildSpikeNotification({
      stateLabel: 'Atrasada',
      targetMs: Date.now() - secondsAgo * 1000,
      countDown: false,
    })
  )
}

/** REGISTRADA: encerra a superfície (cancel-on-resolve, AP-235). */
export async function devDoseSpikeResolve() {
  await notifee.cancelNotification(SPIKE_INSTANCE_ID)
}

export { SPIKE_CHANNEL_ID, SPIKE_INSTANCE_ID, SPIKE_ACTION }
