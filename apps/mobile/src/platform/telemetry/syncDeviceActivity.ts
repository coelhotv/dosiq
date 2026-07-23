// Heartbeat de atividade do app, independente de push (spec 057 / ADR-089).
// Grava app_version+platform+timestamp via RPC upsert_device_activity — SEM depender de nenhuma
// permissão do SO (R-239 intocada: isto NUNCA pede push, roda sempre que há sessão autenticada).
// Best-effort: erro de rede/RPC nunca lança pro caller (espírito AP-303 — telemetria não pode
// quebrar app), e o throttle local evita round-trip de rede desnecessário em idas-e-vindas rápidas
// de foreground (NC2).

import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Application from 'expo-application'
import AsyncStorage from '@react-native-async-storage/async-storage'

const THROTTLE_MS = 24 * 60 * 60 * 1000 // 24h — plan.md Clarifications (FR-003)

function heartbeatStorageKey(deviceFingerprint: string) {
  return `@dosiq/device-activity-last-heartbeat:${deviceFingerprint}`
}

export async function syncDeviceActivity({
  supabase,
  now = () => Date.now(),
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  now?: () => number
}): Promise<void> {
  if (!supabase) return

  try {
    // Mesma estratégia de fingerprint da 043 (sem appVersion na chave — AP-208): device_fingerprint
    // identifica o APARELHO, app_version segue como atributo atualizável do row.
    const deviceFingerprint = JSON.stringify({
      os: Platform.OS,
      osVersion: Platform.Version,
      deviceModel: Device.modelName,
    })

    const storageKey = heartbeatStorageKey(deviceFingerprint)
    const lastRaw = await AsyncStorage.getItem(storageKey)
    const last = lastRaw ? Number(lastRaw) : 0
    const nowMs = now()

    if (last && nowMs - last < THROTTLE_MS) {
      return // throttled — sem round-trip de rede (NC2)
    }

    const { error } = await supabase.rpc('upsert_device_activity', {
      p_device_fingerprint: deviceFingerprint,
      p_platform:           Platform.OS,
      p_app_version:        Application.nativeApplicationVersion ?? '',
    })

    if (error) return // best-effort — nunca lança (FR-002/AP-303)

    await AsyncStorage.setItem(storageKey, String(nowMs))
  } catch {
    // best-effort — telemetria nunca pode quebrar o app
  }
}
