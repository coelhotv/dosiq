// activeDoseItemCache.ts — último DoseItem da dose da Live Activity (Spec 101 C-31)
//
// O "Adiar" da LA chega pela fila do App Intent só com o `instanceId`. Para agendar a soneca o app
// precisa de nome/horário/tolerância, que vinham do banco — offline o "Adiar" não fazia nada (smoke iOS
// 2026-10-11). O bridge grava aqui o DoseItem da dose ativa a cada derive online; a fila usa como
// fallback quando o banco não responde. Best-effort em tudo.

import AsyncStorage from '@react-native-async-storage/async-storage'

export const ACTIVE_DOSE_ITEM_KEY = '@dosiq/live-activity-dose-item'

// O que a soneca usa: agendamento + o `data` do alarme (`buildSingleAlarmData` — corpo da notificação e
// registro pelo "Tomei" dela, C-32). Nada de nome de tratamento/plano.
const FIELDS = [
  'instanceId', 'medicineName', 'scheduledFor', 'toleranceMinutes', 'earlyWindowMinutes', 'critical',
  'protocolId', 'medicineId', 'dosagePerIntake', 'scheduledTime', 'dosagePerPill', 'dosageUnit',
  'concentrationVolumeMl', 'intakeUnit', 'unitsPerMl', 'medicineType', 'presentation',
] as const

/** Grava o DoseItem da dose ativa. Best-effort. */
export async function cacheActiveDoseItem(doseItem: Record<string, unknown> | null | undefined): Promise<void> {
  if (!doseItem?.instanceId) return
  try {
    const slim = Object.fromEntries(FIELDS.map((k) => [k, doseItem[k] ?? null]))
    await AsyncStorage.setItem(ACTIVE_DOSE_ITEM_KEY, JSON.stringify(slim))
  } catch {
    // best-effort
  }
}

/** DoseItem gravado, só se for desta dose. Ausente/ilegível/outra dose → null. */
export async function getCachedDoseItem(instanceId: string): Promise<Record<string, any> | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_DOSE_ITEM_KEY)
    const item = raw ? JSON.parse(raw) : null
    return item && String(item.instanceId) === String(instanceId) && item.scheduledFor ? item : null
  } catch {
    return null
  }
}
