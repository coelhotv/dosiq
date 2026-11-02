// alarmEnabledStore.ts — flags locais de onboarding do alarme nativo (Spec 001, FR-009)
//
// Persistência em AsyncStorage, local ao device. O toggle global do alarme (FR-007:
// `isAlarmEnabled`/`setAlarmEnabled`/`useAlarmEnabled`) foi aposentado na 010 — o controle
// é por tratamento (`protocols.critical_alarm`) — e removido na 039 F5 (T051). A chave
// `@dosiq/alarm-enabled` pode sobrar em aparelhos antigos: ninguém a lê.

import AsyncStorage from '@react-native-async-storage/async-storage'

export const ALARM_NUDGE_SEEN_KEY = '@dosiq/alarm-nudge-seen'
export const ALARM_PERMS_GUIDE_KEY = '@dosiq/alarm-perms-guide-shown'

/**
 * Lê se o nudge de anúncio já foi visto (mostra 1×). Default false.
 * @returns {Promise<boolean>}
 */
export async function hasSeenAlarmNudge() {
  try {
    return (await AsyncStorage.getItem(ALARM_NUDGE_SEEN_KEY)) === 'true'
  } catch {
    return true // erro de leitura → não insistir com o nudge
  }
}

/** Marca o nudge como visto (não mostra mais). */
export async function markAlarmNudgeSeen() {
  try {
    await AsyncStorage.setItem(ALARM_NUDGE_SEEN_KEY, 'true')
  } catch {
    // best-effort
  }
}

/**
 * Guia de permissões (A14+ full-screen + MIUI) já foi mostrado? O grant de
 * full-screen/lock-screen NÃO é consultável via notifee → em vez de checar,
 * mostramos 1× (não a cada toggle — feedback do PO no Xiaomi). Default false.
 * @returns {Promise<boolean>}
 */
export async function hasShownAlarmPermsGuide() {
  try {
    return (await AsyncStorage.getItem(ALARM_PERMS_GUIDE_KEY)) === 'true'
  } catch {
    return true
  }
}

/** Marca o guia de permissões como mostrado. */
export async function markAlarmPermsGuideShown() {
  try {
    await AsyncStorage.setItem(ALARM_PERMS_GUIDE_KEY, 'true')
  } catch {
    // best-effort
  }
}
