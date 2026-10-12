// surfaceAuditBeacon.ts — rastro da superfície contínua Android (spec 084, CON-031).
//
// Cada transição REAL do card (later/upcoming/now/late/missed) vira 1 linha `surface_transitioned`
// `platform='android'`. Três origens em `detail.source`: `boundary` (trigger entregue, bg/fg), `app`
// (derive do app) e `alarm` (reconciliação pelo alarme entregue). Re-exibição não chega aqui: quem
// chama já descartou (classificação no agendamento / estado exibido).
//
// ENFILEIRA (AsyncStorage) e o flush do foreground insere, como o beacon de alarme. Fila PRÓPRIA
// (INV-4): a rajada de superfície nunca desloca `alarm_fired`/`nag_fired` do cap da fila deles.
// Instância ÚNICA no módulo: o lock da fila é por instância (criticalAuditQueue:95), e duas instâncias
// na mesma chave perdem item no read-modify-write.
//
// Fail-open TOTAL: jamais lança (roda no handler headless, AP-205 — lazy-required lá).

import { Platform } from 'react-native'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { getRawNow } from '@dosiq/core'
import { createCriticalAuditQueue, type FlushInsertOne } from './criticalAuditQueue'

export const SURFACE_AUDIT_QUEUE_KEY = '@dosiq/audit/surface-queue'
export const surfaceAuditQueue = createCriticalAuditQueue({ key: SURFACE_AUDIT_QUEUE_KEY })

const SURFACE_STATES = new Set(['later', 'upcoming', 'now', 'late', 'missed'])
const SOURCES = new Set(['boundary', 'app', 'alarm'])

/**
 * Dono pela sessão PERSISTIDA. `getSession()` é leitura local; `getUser()` vai ao servidor de Auth
 * (`GoTrueClient.js:1263-1294`, supabase-js 2.91) e offline devolve `null`, o que anularia a fila
 * (AP-357).
 */
async function resolveUserId() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.user?.id ?? null
  } catch {
    return null
  }
}

export interface SurfaceTransitionInput {
  instanceId: string | null | undefined
  from: string | null | undefined
  to: string | null | undefined
  source: 'boundary' | 'app' | 'alarm' | string
  occurredAt?: string
}

/**
 * Enfileira uma transição da superfície. `occurredAt` é o instante do fato (INV-5): o chamador o
 * carimba na origem; sem ele, carimba aqui, antes de qualquer await.
 */
export async function enqueueSurfaceTransition({ instanceId, from, to, source, occurredAt }: SurfaceTransitionInput) {
  try {
    const at = occurredAt || getRawNow().toISOString()
    if (Platform.OS !== 'android') return
    if (!instanceId || !SURFACE_STATES.has(to) || !SOURCES.has(source)) return
    const userId = await resolveUserId()
    if (!userId) return // sem dono → evento órfão proibido (CON-031)
    await surfaceAuditQueue.enqueue({
      userId,
      doseInstanceId: instanceId,
      event: 'surface_transitioned',
      platform: 'android',
      actor: 'system',
      detail: { from: SURFACE_STATES.has(from) ? from : null, to, source }, // INV-3: nada além disso
      occurredAt: at,
    })
  } catch {
    // Fail-open: o rastro jamais quebra a superfície nem o alarme (INV-1).
  }
}

/**
 * Trigger de boundary ENTREGUE: a transição foi classificada no agendamento e viaja no payload
 * (`transitionFrom`/`transitionTo`). Sem `transitionTo` = re-exibição (T0, cap) ou payload de build
 * antigo → nada a emitir.
 * @param {object} data - `notification.data` (strings)
 * @param {string} [occurredAt]
 */
export function emitDeliveredTransition(data, occurredAt?: string) {
  return enqueueSurfaceTransition({
    instanceId: data?.doseInstanceId,
    from: data?.transitionFrom || null,
    to: data?.transitionTo,
    source: 'boundary',
    occurredAt,
  })
}

/**
 * Drena a fila da superfície (foreground, chamado pelo flush do AlarmSchedulerBridge depois da fila
 * de alarme). Mesmo inserter e mesma regra de consentimento das demais classes (FR-007).
 */
export function drainSurfaceAudit(insertOne: FlushInsertOne) {
  return surfaceAuditQueue.flush(insertOne)
}
