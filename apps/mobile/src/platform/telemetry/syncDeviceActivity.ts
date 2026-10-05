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
import { getInstallId } from './installId'

const THROTTLE_MS = 24 * 60 * 60 * 1000 // 24h — plan.md Clarifications (FR-003)

// 085 C2 (smoke do PO): a versão do app entra na CHAVE DO THROTTLE — não no fingerprint, que segue
// identificando o aparelho (AP-208). Sem isso, atualizar o app até 24h depois do último heartbeat
// deixava o row dizendo a versão ANTIGA por até 24h: a trava por usuária da cadência
// (`isIntervalCadenceAvailable`) e o relatório de frota do version gate liam o aparelho como
// desatualizado justamente logo depois de cada release.
function heartbeatStorageKey(deviceFingerprint: string, appVersion: string) {
  return `@dosiq/device-activity-last-heartbeat:${deviceFingerprint}:${appVersion}`
}

export async function syncDeviceActivity({
  supabase,
  now = () => Date.now(),
}: {
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

    const appVersion = Application.nativeApplicationVersion ?? ''
    const storageKey = heartbeatStorageKey(deviceFingerprint, appVersion)
    const lastRaw = await AsyncStorage.getItem(storageKey)
    const last = lastRaw ? Number(lastRaw) : 0
    const nowMs = now()

    if (last && nowMs - last < THROTTLE_MS) {
      return // throttled — sem round-trip de rede (NC2)
    }

    const { error } = await supabase.rpc('upsert_device_activity', {
      p_device_fingerprint: deviceFingerprint,
      p_platform:           Platform.OS,
      p_app_version:        appVersion,
      // 095: linha por instalação (dois apps no mesmo aparelho, SO atualizado). null = caminho legado.
      p_install_id:         await getInstallId(),
    })

    if (error) return // best-effort — nunca lança (FR-002/AP-303)

    await AsyncStorage.setItem(storageKey, String(nowMs))
  } catch {
    // best-effort — telemetria nunca pode quebrar o app
  }
}

/**
 * Saída da conta (spec 095, FR-006): apaga a linha de atividade DESTA instalação na conta que sai,
 * para a trava da cadência não seguir julgando a conta por um app que não é mais dela.
 * Best-effort: sem id ou sem rede, a linha tem a versão atual e expira em 30 d (FR-011).
 */
export async function deleteDeviceActivity({ supabase }: { supabase: any }): Promise<void> {
  if (!supabase) return
  try {
    const installId = await getInstallId()
    if (!installId) return
    await supabase.rpc('delete_device_activity', { p_install_id: installId })
  } catch {
    // best-effort — logout nunca espera por telemetria (INV-3)
  }
}
