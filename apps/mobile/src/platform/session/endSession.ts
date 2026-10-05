// endSession.ts — ponto ÚNICO de saída da conta no aparelho (spec 091, FR-001/FR-003/FR-004)
//
// Antes: três caminhos de logout (profileService.logoutUser, authService.signOut, listener
// SIGNED_OUT), cada um limpando uma lista diferente, e nenhum desativando o aparelho para push.
// Agora todos passam por aqui, numa ordem que NÃO é intercambiável:
//
//   1. drena a fila de auditoria      — precisa da sessão de quem sai (os inserts são dela)
//   2. desativa o aparelho p/ push    — idem: RLS por user_id (RC-SEC S-1); em paralelo, apaga a
//      linha de atividade desta instalação (spec 095 FR-006 — senão a trava da cadência segue
//      julgando a conta por este app)
//   3. evento `logout`                — ANTES do signOut (AP-358: o listener reseta a identidade)
//   4. marca de UI (só `invalid`)     — ANTES do signOut: a Landing monta de dentro dele
//   5. signOut local                  — dispara SIGNED_OUT; o listener vê `isEndingSession()`
//   6. wipe por allowlist             — o que sobrou da fila é descartado aqui, contado
//   7. resetUser                      — identidade analítica anônima de novo (CON-021)
//
// `deleted` pula 1 e 2: o chamador drenou ANTES do RPC de exclusão (depois dele o insert bate na
// FK) e as linhas de notification_devices e device_activity somem em cascata com a conta.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createCriticalAuditService, type CriticalAuditEvent } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { createCriticalAuditQueue } from '@platform/audit/criticalAuditQueue'
import { ALARM_OUT_OF_WINDOW_EVENT } from '@platform/alarms/outOfWindowNotice'
import { PUSH_TOKEN_KEY } from '@platform/notifications/registerPushToken'
import { unregisterNotificationDevice } from '@platform/notifications/unregisterNotificationDevice'
import { deleteDeviceActivity } from '@platform/telemetry/syncDeviceActivity'
import { logEvent, resetUser } from '@platform/analytics/productAnalytics'
import { EVENTS, SURFACES } from '@platform/analytics/analyticsEvents'
import { wipeLocalUserData, SESSION_ENDED_REASON_KEY, LIVE_ACTIVITY_PUSH_TOKEN_KEY } from './localDataWipe'

export type EndSessionReason = 'logout' | 'deleted' | 'invalid'

export interface EndSessionResult {
  success: boolean
  auditDiscarded: number
}

const auditQueue = createCriticalAuditQueue()

let inFlight: Promise<EndSessionResult> | null = null

/** true enquanto um encerramento roda — o listener SIGNED_OUT usa para não se tratar como externo. */
export function isEndingSession(): boolean {
  return inFlight !== null
}

/**
 * Drena a fila de auditoria sob a sessão ATUAL. Devolve quantos itens ficaram.
 *
 * A anomalia de janela (067 FR-035) só pode ser gravada com consentimento confirmado; aqui, na
 * saída, o estado do consentimento não está à mão — então ela é DESCARTADA, nunca gravada sem base
 * legal (analysis G-5). Os demais eventos já ocorreram e seguem para a trilha.
 */
export async function drainAuditQueue(): Promise<{ remaining: number }> {
  try {
    const emitter = createCriticalAuditService({ client: supabase as any })
    const { remaining } = await auditQueue.flush((evt) => {
      if (evt?.event === ALARM_OUT_OF_WINDOW_EVENT) return Promise.resolve(true)
      return emitter.emit(evt as unknown as CriticalAuditEvent)
    })
    return { remaining }
  } catch {
    const { items } = await auditQueue.peek()
    return { remaining: items.length }
  }
}

// Cada canal de push que o aparelho registrou em nome da pessoa: o Expo (todas as plataformas) e o
// push-to-start do Live Activity (iOS 17.2+). Esquecer um deles deixa o servidor falando com o
// aparelho em nome de quem saiu (RC-SEC S-1; o segundo canal apareceu no smoke de 28/09).
const DEVICE_PUSH_CHANNELS = [
  { key: PUSH_TOKEN_KEY, provider: 'expo' },
  { key: LIVE_ACTIVITY_PUSH_TOKEN_KEY, provider: 'apns_liveactivity' },
] as const

async function deactivatePushDevice(userId: string) {
  for (const { key, provider } of DEVICE_PUSH_CHANNELS) {
    try {
      const token = await AsyncStorage.getItem(key)
      if (token) await unregisterNotificationDevice({ supabase, userId, token, provider })
    } catch {
      // Best-effort: sem rede, o token é reatribuído no próximo registro (upsert por token).
    }
  }
}

function isSessionMissing(error: any): boolean {
  return Boolean(error?.message?.includes('session missing') || error?.name === 'AuthSessionMissingError')
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.user?.id ?? null
  } catch {
    return null
  }
}

/** Passos 1–2: o que precisa da sessão de quem sai. Devolve quantos itens de auditoria sobraram. */
async function settleWhileSessionAlive(reason: EndSessionReason, userId: string | null): Promise<number> {
  if (reason === 'deleted') return (await auditQueue.peek()).items.length
  const { remaining } = await drainAuditQueue()
  // Em paralelo: a saída não fica mais lenta por causa da telemetria (095, C1.5 K-3).
  if (userId) await Promise.all([deactivatePushDevice(userId), deleteDeviceActivity({ supabase })])
  return remaining
}

/**
 * Passo 5. Logout voluntário que falhou de verdade: a sessão segue viva, então os dados também
 * ficam (INV-2 — nunca "desloga" apagando storage). Sessão já ausente conta como saída feita (E-2).
 * `invalid`/`deleted` seguem para o wipe de qualquer forma: a sessão não vale mais nada.
 */
async function signOutLocal(reason: EndSessionReason): Promise<boolean> {
  let error: unknown = null
  try {
    error = (await supabase.auth.signOut({ scope: 'local' })).error
  } catch (err) {
    error = err
  }
  return !(error && reason === 'logout' && !isSessionMissing(error))
}

async function runEndSession(reason: EndSessionReason): Promise<EndSessionResult> {
  const userId = await currentUserId()
  const auditDiscarded = await settleWhileSessionAlive(reason, userId)

  if (reason === 'logout') await logEvent(EVENTS.LOGOUT, { surface: SURFACES.MOBILE })
  if (reason === 'invalid') {
    await AsyncStorage.setItem(SESSION_ENDED_REASON_KEY, 'invalid').catch(() => {})
  }

  if (!(await signOutLocal(reason))) return { success: false, auditDiscarded: 0 }

  await wipeLocalUserData()
  if (auditDiscarded > 0 && __DEV__) {
    console.warn(`[endSession] ${reason}: ${auditDiscarded} evento(s) de auditoria descartado(s)`)
  }
  await resetUser()
  return { success: true, auditDiscarded }
}

/**
 * Encerra a sessão e limpa o aparelho. Chamadas concorrentes (listener + Perfil + verificação de
 * foreground) compartilham a mesma execução — nunca dois signOut/wipe em paralelo.
 */
export function endSession(reason: EndSessionReason): Promise<EndSessionResult> {
  if (inFlight) return inFlight
  inFlight = runEndSession(reason).finally(() => {
    inFlight = null
  })
  return inFlight
}

/**
 * SIGNED_OUT que NÃO veio de `endSession`: o auth-js derrubou a sessão sozinho (refresh negado,
 * `session_not_found`). Para a pessoa é sessão inválida — mesma limpeza, mesma mensagem.
 */
export async function handleExternalSignOut(): Promise<void> {
  if (isEndingSession()) return
  await AsyncStorage.setItem(SESSION_ENDED_REASON_KEY, 'invalid').catch(() => {})
  await wipeLocalUserData()
  await resetUser()
}
