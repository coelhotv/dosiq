// criticalAuditBeacon.js — beacon de auditoria de dose crítica no disparo do alarme (spec 042 Slice B).
//
// Chamado do onBackgroundEvent (DELIVERED) do Notifee — Android roda JS headless no disparo, então
// captura `alarm_fired`/`nag_fired` (ou `alarm_suppressed` quando as notificações estão bloqueadas)
// COM um snapshot de permissão, e ENFILEIRA (AsyncStorage). A inserção no DB acontece só no foreground
// (flush) — o disparo pode estar offline. iOS não roda JS no disparo (AP-257) → seu desfecho é derivado
// no foreground por deriveIosAlarmOutcome; este beacon é o caminho Android.
//
// Fail-open TOTAL: jamais lança (não pode quebrar o handler de alarme). Lazy-required no handler
// (AP-205) — importar supabase/notifee aqui é seguro porque não é top-level do index.js.

import { Platform } from 'react-native'
import notifee, { AuthorizationStatus, AndroidImportance } from '@notifee/react-native'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { ALARM_CRITICAL_CHANNEL_ID } from '@platform/alarms/alarmService'
import { getRawNow } from '@dosiq/core'
import { createCriticalAuditQueue } from './criticalAuditQueue'

/** Snapshot mínimo de permissão (sem PII) — usado para diagnosticar "o alarme não tocou". */
async function buildPermissionSnapshot() {
  try {
    const settings = await notifee.getNotificationSettings()
    const status = settings?.authorizationStatus
    const authorized =
      status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL
    const snapshot: { authorization_status: any; blocked: boolean; android_channel_importance?: any } =
      { authorization_status: status ?? null, blocked: !authorized }
    // Android: o canal crítico pode estar rebaixado a NONE mesmo com app "autorizado" → bloqueia o som.
    if (Platform.OS === 'android') {
      try {
        const channel = await notifee.getChannel(ALARM_CRITICAL_CHANNEL_ID)
        const importance = channel?.importance ?? null
        snapshot.android_channel_importance = importance
        if (importance === AndroidImportance.NONE) snapshot.blocked = true
      } catch {
        // canal ausente/erro — mantém o snapshot base
      }
    }
    return snapshot
  } catch {
    // getNotificationSettings falhou — snapshot nulo, mas ainda enfileira o beacon (fail-open).
    return null
  }
}

/** Resolve o dono da dose pela sessão persistida (AsyncStorage) — funciona no headless. */
async function resolveUserId() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Monta e enfileira o beacon de um alarme crítico ENTREGUE (Android headless).
 * @param {object} data - `notification.data` do evento DELIVERED (strings — contrato Notifee).
 */
export async function beaconAlarmDelivered(data) {
  try {
    // 067 C.2 (FR-042) — carimba o instante do DISPARO aqui, na ORIGEM, ANTES de qualquer await.
    // A linha só entra no banco no flush (foreground), então `created_at` é a hora do FLUSH: medido
    // no smoke do B1, alarme às 12:00:00 virou linha às 12:19:58. Ler `created_at` como hora de
    // disparo errava 20 min na plataforma tida como confiável — e o erro cresce com o tempo que o
    // app fica fechado, que é justamente o cenário da dose da madrugada.
    const occurredAt = getRawNow().toISOString()

    const doseInstanceId = data?.doseInstanceId
    if (!doseInstanceId) return
    // Só dose crítica gera trail (FR-004). Agrupados/normais não-críticos ficam de fora.
    if (data?.isCritical !== 'true') return

    const userId = await resolveUserId()
    if (!userId) return // sem dono → evento órfão proibido (não enfileira)

    const snapshot = await buildPermissionSnapshot()
    const nagAttempt = Number(data?.nagAttempt ?? 0) || 0

    let event
    const detail: { permission_snapshot: any; reason?: string } = { permission_snapshot: snapshot }
    if (snapshot?.blocked) {
      event = 'alarm_suppressed'
      detail.reason = 'notifications_blocked'
    } else if (nagAttempt > 0) {
      event = 'nag_fired'
    } else {
      event = 'alarm_fired'
    }

    // camelCase (shape de entrada do criticalAuditService.emit — usado no flush; DRY CON-031).
    const queue = createCriticalAuditQueue()
    await queue.enqueue({
      userId,
      doseInstanceId,
      event,
      platform: Platform.OS,
      actor: 'system',
      detail,
      occurredAt,
    })
  } catch {
    // Fail-open: beacon jamais quebra o handler de alarme.
  }
}

export default beaconAlarmDelivered
