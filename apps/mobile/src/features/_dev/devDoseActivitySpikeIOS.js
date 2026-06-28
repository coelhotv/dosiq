// devDoseActivitySpikeIOS.js — spike DEV-only iOS do épico 039 (PO-0.1).
//
// Chama o bridge nativo DoseActivityBridge (Swift/ActivityKit) p/ iniciar/encerrar
// a Live Activity. Prova: timer vivo na Dynamic Island + Lock Screen, sem APNs.
// Guarda contra Android e contra módulo ausente (antes do wiring no Xcode).

import { NativeModules, Platform } from 'react-native'

const { DoseActivityBridge } = NativeModules

function ensureAvailable() {
  if (Platform.OS !== 'ios') {
    console.warn('[039 spike] Live Activity é iOS-only')
    return false
  }
  if (!DoseActivityBridge) {
    console.warn('[039 spike] DoseActivityBridge não linkado — fazer wiring no Xcode (ver SPIKE_iOS.md)')
    return false
  }
  return true
}

/** PRÓXIMA: countdown regressivo até daqui a `seconds`. */
export async function devLiveActivityUpcoming(seconds = 60) {
  if (!ensureAvailable()) return
  await DoseActivityBridge.start({
    medicineLabel: 'Lantus',
    instanceId: 'dev-la-spike',
    state: 'now',
    stateLabel: 'Hora da dose',
    scheduledAtMs: Date.now() + seconds * 1000,
  })
}

/** ATRASADA: count-up desde `secondsAgo` atrás. */
export async function devLiveActivityLate(secondsAgo = 120) {
  if (!ensureAvailable()) return
  await DoseActivityBridge.start({
    medicineLabel: 'Lantus',
    instanceId: 'dev-la-spike',
    state: 'late',
    stateLabel: 'Atrasada',
    scheduledAtMs: Date.now() - secondsAgo * 1000,
  })
}

/** REGISTRADA: encerra a Live Activity (cancel-on-resolve). */
export async function devLiveActivityEnd() {
  if (!ensureAvailable()) return
  await DoseActivityBridge.end()
}
