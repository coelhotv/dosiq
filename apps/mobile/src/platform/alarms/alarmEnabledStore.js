// alarmEnabledStore.js — preferência local do alarme nativo (Spec 001, FR-007)
//
// Persistência em AsyncStorage (NÃO em user_settings — adicionar coluna seria
// migration = Tier 2; o toggle do alarme é local ao device, Tier 1).
//
// Default OFF (opt-in): o alarme invasivo (full-screen + bypass DND) NUNCA liga
// sozinho — o usuário ativa conscientemente (FR-007). O nudge (FR-009) apenas
// anuncia e leva ao toggle, sem ativar nada.

import AsyncStorage from '@react-native-async-storage/async-storage'

export const ALARM_ENABLED_KEY = '@dosiq/alarm-enabled'
export const ALARM_NUDGE_SEEN_KEY = '@dosiq/alarm-nudge-seen'
export const ALARM_PERMS_GUIDE_KEY = '@dosiq/alarm-perms-guide-shown'

/**
 * Lê se o alarme nativo está ligado. Default OFF.
 * @returns {Promise<boolean>}
 */
export async function isAlarmEnabled() {
  try {
    const raw = await AsyncStorage.getItem(ALARM_ENABLED_KEY)
    return raw === 'true'
  } catch {
    return false
  }
}

/**
 * Persiste o estado do toggle do alarme.
 * @param {boolean} enabled
 */
export async function setAlarmEnabled(enabled) {
  try {
    await AsyncStorage.setItem(ALARM_ENABLED_KEY, enabled ? 'true' : 'false')
  } catch {
    // best-effort — falha de storage não deve quebrar a UI do toggle
  }
}

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
