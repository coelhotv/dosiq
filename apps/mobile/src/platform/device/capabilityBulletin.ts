// capabilityBulletin.ts — boletim `device_capability` (spec 082 D2)
//
// O boletim NEGATIVO invalida no servidor toda prova de alarme anterior a ele
// (`findLatestIncapableAt`); o POSITIVO só registra. Dois chamadores:
//  - `useAlarmScheduler.syncAlarms` — fim de todo sync, com throttle (muda `capable` ou 24 h);
//  - `alarmService` após a soneca — o `snoozed` de aparelho é PROVA (082 D1) e, num aparelho que
//    não alarma, chegaria DEPOIS do negativo e o anularia (smoke T101: push `suprimida_alarme`
//    com o canal desligado). Reafirmar o negativo, sem throttle, põe o corte depois da soneca.
//
// Emissões são SERIALIZADAS: dois syncs simultâneos (permissão + foreground) liam o throttle antes
// de qualquer um gravar e emitiam o mesmo boletim duas vezes (smoke T101, 150 ms de diferença).

import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { createCriticalAuditService } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { probeDevice, deriveCapability, type DeviceFacts, type CapabilityVerdict } from './deviceProbe'

// Throttle: só emite se `capable` mudou desde o último boletim ACEITO ou se passaram 24 h.
export const CAPABILITY_AUDIT_KEY = '@dosiq/audit/device_capability_last'
export const CAPABILITY_REFRESH_MS = 24 * 60 * 60 * 1000

export type CapabilityRead = { verdict: CapabilityVerdict; facts: DeviceFacts }

let _chain: Promise<unknown> = Promise.resolve()

/** Sonda o aparelho e deriva a capacidade. `null` = não emitir (sem crítico ou fato desconhecido). */
export async function readCapability(expectedIds: string[]): Promise<CapabilityRead | null> {
  try {
    const facts = await probeDevice()
    const verdict = deriveCapability(facts, expectedIds)
    return verdict ? { verdict, facts } : null
  } catch {
    return null
  }
}

async function _throttled(capable: boolean, nowMs: number): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CAPABILITY_AUDIT_KEY)
    const last = raw ? JSON.parse(raw) : null
    return last?.capable === capable && typeof last?.at === 'number' && nowMs - last.at < CAPABILITY_REFRESH_MS
  } catch {
    return false // throttle é best-effort: na dúvida, emite
  }
}

async function _emit({ verdict, facts }: CapabilityRead, userId: string | null, force: boolean) {
  const nowMs = Date.now()
  if (!force && (await _throttled(verdict.capable, nowMs))) return
  const audit = createCriticalAuditService({
    client: supabase as any,
    // Sem userId (soneca headless): resolve pela sessão persistida, como o `snoozed`.
    getUserId: async () => (await supabase.auth.getUser())?.data?.user?.id ?? null,
  })
  const res = await audit
    .emit({
      ...(userId ? { userId } : {}),
      doseInstanceId: null,
      event: 'device_capability',
      platform: Platform.OS,
      actor: 'system',
      detail: {
        capable: verdict.capable,
        notifications_allowed: facts.notificationsAllowed,
        alarm_channel_blocked: facts.alarmChannelBlocked,
        exact_alarm_allowed: facts.exactAlarmAllowed,
        background_restricted: facts.backgroundRestricted,
        critical_expected: verdict.criticalExpected,
        critical_armed: verdict.criticalArmed,
        app_version: Constants.expoConfig?.version ?? null,
      },
    })
    .catch(() => ({ ok: false }))
  if (res?.ok !== true) return
  try {
    await AsyncStorage.setItem(CAPABILITY_AUDIT_KEY, JSON.stringify({ capable: verdict.capable, at: nowMs }))
  } catch {
    /* fail-open */
  }
}

/**
 * Emite o boletim. `detail` = allowlist FECHADA de fatos do aparelho — nunca medicamento/dose.
 * Insert falho NÃO grava o throttle ⇒ o próximo sync tenta de novo (PO-D2-3). Nunca rejeita.
 */
export function emitCapability(read: CapabilityRead, userId: string | null, opts: { force?: boolean } = {}) {
  const run = _chain.then(() => _emit(read, userId, opts.force === true)).catch(() => {})
  _chain = run
  return run
}

/**
 * Pós-soneca: se o aparelho não alarma, reafirma o negativo SEM throttle — o `snoozed` recém-emitido
 * é posterior ao negativo anterior e o anularia no servidor. Aparelho capaz ou fato desconhecido ⇒ nada.
 * @param snoozedIds - ocorrências adiadas (contam como esperadas; o trigger da soneca usa o mesmo id)
 */
export async function reassertIncapableAfterSnooze(snoozedIds: string[]): Promise<void> {
  const read = await readCapability(snoozedIds)
  if (read?.verdict.capable !== false) return
  await emitCapability(read, null, { force: true })
}
