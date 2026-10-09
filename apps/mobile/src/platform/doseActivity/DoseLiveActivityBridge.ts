// DoseLiveActivityBridge.jsx — Spec 039 / F3 (iOS Live Activity)
//
// Contraparte iOS do DoseActivityBridge (Android). Deriva a ÚNICA dose ativa entre as críticas
// pendentes (selectActiveDoseActivity / CON-029) e dirige a Live Activity (start/update/end via
// liveActivityService). iOS-only: render nulo e no-op fora do iOS.
//
// Diferença de plataforma vs Android: o iOS NÃO executa JS em background (sem equivalente ao trigger
// Notifee/reconcileDoseActivityFromAlarm). O timer da LA é VIVO (Text(timerInterval:) conta sozinho,
// server-free). As transições de ESTADO discreto (cor/label/botões) acontecem por:
//  (a) re-derive via update() no mount/foreground/resync — o alarme crítico T0 (fullscreen) traz o
//      app ao foreground, cobrindo later→upcoming→now;
//  (b) `staleDate` (= próximo boundary, liveActivityService) → quando passa, o sistema re-renderiza
//      a LA em background e o widget RECALCULA o estado de scheduledAt+now (cobre now→late server-free).
// Limitação: só UM hop por update em background profundo. Multi-hop sem o app abrir exigiria
// ActivityKit push/APNs — FORA do escopo server-free da 039 (FR-009); seria uma spec futura separada.
//
// Ações da ilha (App Intent Registrar/Adiar) chegam pela fila do App Group: drenamos no foreground
// e processamos com SESSÃO VIVA (PO-SEC-2) — "Registrar" abre a modal bulk (sítio do injetável),
// "Adiar" reagenda o alarme.

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import {
  createDoseInstanceRepository,
  buildDoseItemsFromInstances,
  selectActiveDoseActivity,
  getRawNow,
  addDays,
  getTodayLocal,
  formatTimePtBR,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'

import { useAuth } from '@platform/auth/hooks/useAuth'
import { useConsentSuppressed } from '@platform/consent/useConsentSuppressed'
import { getActiveProtocols, getUserSettings, getMedicinesData } from '@dashboard/services/dashboardService'
import { onAlarmResync } from '@platform/alarms/alarmResyncBus'
import { onDoseActivityRefresh } from './doseActivityRefreshBus'
import { navigateToDose } from '@navigation/navigateToDose'
import { scheduleSnooze } from '@platform/alarms/alarmService'
import { getSnoozeAnchors, mergeSnoozeAnchors } from '@platform/alarms/snoozeAnchorStore'
import { useToast } from '@shared/components/feedback/Toast'
import {
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
  showDoneLiveActivity,
  drainPendingActions,
  liveActivitySupported,
} from './liveActivityService'
import { registerPushToStart, resetPushToStartDedupe } from './pushToStartRegistration'
import { syncActivityToken, forgetSyncedToken } from './syncActivityToken'
import { emitReminderOpened } from '@platform/analytics/reminderEvents'
import { REMINDER_SOURCES, SURFACES } from '@platform/analytics/analyticsEvents'

const DEFAULT_TZ = 'America/Sao_Paulo'
const LOOK_AHEAD_DAYS = 3
const LOOK_BACK_DAYS = 3
const RESYNC_INTERVAL_MS = 15 * 60 * 1000

/** Limpa o token per-Activity ao encerrar localmente a LA (paridade com o end-push do backend). @private */
async function _clearActivityToken(instanceId) {
  if (!instanceId) return
  forgetSyncedToken(instanceId) // FR-041: LA encerrada solta o dedupe (ver syncActivityToken.ts)
  try {
    await supabase.from('dose_instances').update({ la_push_token: null, la_push_state: null }).eq('id', instanceId)
  } catch {
    // best-effort
  }
}

/**
 * Deriva a dose ativa (crítica pendente) e start/update/end a LA. Retorna o instanceId cuja LA este
 * processo de fato mantém (ou null).
 *
 * Spec 101 C-13: só age em FOREGROUND. O push-to-start (recriação da soneca, start da janela) acorda o
 * app em background; ali o `Activity.request` falha e o `start` encerrava a LA do servidor — em
 * background quem dirige a LA é o servidor. E só marca a dose como armada quando a LA existe.
 */
export async function deriveAndDrive({ userId, protocols, tz, prevInstanceId, foreground = true }) {
  if (!foreground) return prevInstanceId
  const repo = createDoseInstanceRepository({ client: supabase as any })
  const now = getRawNow()
  const instances = await repo.getWindow(userId, addDays(now, -LOOK_BACK_DAYS), addDays(now, LOOK_AHEAD_DAYS))
  // Spec 101 (FR-006): âncora local mesclada — dose adiada fica fora do seletor até `snoozedUntil`, e a LA
  // é encerrada pelo ramo `!active`/troca abaixo (que também zera `la_push_token`: pré-condição para o
  // servidor recriá-la no claim da soneca, FR-008).
  const allItems = mergeSnoozeAnchors(
    buildDoseItemsFromInstances(instances, protocols, tz),
    await getSnoozeAnchors(now.getTime())
  )
  const items = allItems.filter((it) => it.status === 'pending' && it.critical)
  const active = selectActiveDoseActivity(items, now)

  // A dose que mostrávamos virou `taken`? → card `done` (~3min) em vez de só encerrar. Retorna o
  // HORÁRIO REAL da tomada (registeredAt), NÃO `now` — senão o card mostra a hora do re-derive
  // (ex.: reabertura do app), não quando o paciente tomou. Fallback `now` se o campo faltar.
  const prevTakenAt = (id) => {
    const prev = allItems.find((it) => it.instanceId === id)
    if (!prev) return null
    if (prev.status === 'taken' || prev.isRegistered === true) return prev.registeredAt || now
    return null
  }

  if (!active) {
    if (prevInstanceId) {
      const takenAt = prevTakenAt(prevInstanceId)
      if (takenAt) await showDoneLiveActivity({ instanceId: prevInstanceId, takenAt })
      else await endLiveActivity()
      await _clearActivityToken(prevInstanceId) // LA encerrada → token não serve mais
    }
    return null
  }
  const doseItem = items.find((it) => it.instanceId === active.instanceId) || null
  if (prevInstanceId === active.instanceId) {
    // Mesma dose → transição de estado sem recriar. Nenhuma LA nativa atualizada (0) ⇒ ela sumiu por
    // fora (encerrada pelo SO/servidor): recria (C-13b).
    const updated = await updateLiveActivity(active, doseItem)
    if (updated === 0 && !(await startLiveActivity(active, doseItem))) return null
  } else {
    // Trocou de dose: se a anterior foi tomada, confirma; senão encerra. Depois inicia a nova.
    if (prevInstanceId) {
      const takenAt = prevTakenAt(prevInstanceId)
      if (takenAt) await showDoneLiveActivity({ instanceId: prevInstanceId, takenAt })
      else await endLiveActivity()
      await _clearActivityToken(prevInstanceId)
    }
    // C-13b: `start` falhou (LA desligada, background, iOS antigo) ⇒ nada armado; o próximo derive tenta.
    if (!(await startLiveActivity(active, doseItem))) return null
  }
  // Fase 2: sincroniza o token per-Activity da LA ativa (idempotente; backend usa p/ update/end).
  await syncActivityToken(active.instanceId)
  return active.instanceId
}

/** PO-SEC-2: confirma sessão VIVA antes de agir sobre uma ação da ilha. @private */
async function liveUserId() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/** Protocolos ativos enriquecidos com o medicamento (compartilhado por load() e pela ação). @private */
async function fetchEnrichedProtocols(userId, tz) {
  const protos = await getActiveProtocols(userId, getTodayLocal(tz))
  const list = Array.isArray(protos) ? protos : []
  const medIds = [...new Set(list.map((p) => p.medicine_id).filter(Boolean))]
  const medsById = medIds.length ? await getMedicinesData(medIds) : {}
  return list.map((p) => ({ ...p, medicine: medsById[p.medicine_id] || null }))
}

/** Resolve o doseItem (CON-029) de um instanceId p/ montar o deeplink da modal. @private */
async function resolveDoseItem(userId, protocols, tz, instanceId) {
  const repo = createDoseInstanceRepository({ client: supabase as any })
  const now = getRawNow()
  const instances = await repo.getWindow(userId, addDays(now, -LOOK_BACK_DAYS), addDays(now, LOOK_AHEAD_DAYS))
  const items = buildDoseItemsFromInstances(instances, protocols, tz)
  return items.find((it) => it.instanceId === instanceId) || null
}

/**
 * Deeplink da modal bulk a partir do doseItem — MESMO shape do Android (buildRegisterDeeplink):
 * plano → 'bulk-plan' (planId + at + treatmentPlanName); avulsa → 'dose-individual' (protocolId + at).
 * TodayScreen._resolveDeeplinkModal exige planId (bulk) ou protocolId (individual) — instanceId NÃO
 * abre nada (era o bug). Fallback p/ treatmentId da fila se o doseItem não resolver. @private
 */
function buildRegisterParams(doseItem, fallbackTreatmentId) {
  const at = doseItem?.scheduledTime || ''
  const planId = doseItem?.treatmentPlanId || fallbackTreatmentId || ''
  if (planId) {
    return { screen: 'bulk-plan', planId, at, treatmentPlanName: doseItem?.treatmentPlanName || doseItem?.medicineName || '' }
  }
  if (doseItem?.protocolId) {
    return { screen: 'dose-individual', protocolId: doseItem.protocolId, at }
  }
  return null
}

/**
 * Spec 101 (FR-010): texto da confirmação do "Adiar" vindo da LA. HH:MM sai do retorno do agendamento
 * (`fireAt`), nunca recomputado aqui. Recusa (janela/teto/dose não resolvida) nunca mostra sucesso.
 */
export function snoozeToastMessage(result) {
  if (!result || !Number.isFinite(result.fireAt)) return 'Não foi possível adiar esta dose agora.'
  // Hora do aparelho, como o próprio alarme e o helper canônico (Hermes sem ICU: sem Intl/timeZone).
  // fireAt é epoch ms — instante absoluto, sem a ambiguidade de 'YYYY-MM-DD' que o R-020 barra.
  // eslint-disable-next-line no-restricted-syntax
  return `Alarme reagendado para ${formatTimePtBR(new Date(result.fireAt))}`
}

/**
 * "Adiar" da LA: enriquece a soneca com o doseItem (nome/horário/tolerância/criticidade) — senão a notif
 * reagendada fica genérica. doseItem null (deletado/offline) → não agenda: scheduledFor undefined num
 * param obrigatório daria agendamento inválido (Gemini #692). Retorna o resultado do agendamento
 * (`{ fireAt }` | false). @private
 */
async function _snoozeQueuedItem(uid, protocols, tz, instanceId) {
  const doseItem = await resolveDoseItem(uid, protocols, tz, instanceId).catch(() => null)
  if (!doseItem) return false
  return scheduleSnooze({
    doseInstanceId: instanceId,
    medicineName: doseItem.medicineName,
    scheduledFor: doseItem.scheduledFor,
    toleranceMinutes: doseItem.toleranceMinutes ?? null,
    isCritical: doseItem.critical ?? true,
    data: { doseInstanceId: instanceId, medicineName: doseItem.medicineName, scheduledFor: doseItem.scheduledFor },
    source: REMINDER_SOURCES.DOSE_ACTIVITY,
    surface: SURFACES.PUSH,
  })
}

/**
 * Processa a fila de ações do App Intent (App Group) com sessão viva.
 * @param {string} tz
 * @param {{ onSnoozeResult?: (instanceId: string, result: false | { fireAt: number }) => unknown }} [hooks]
 */
export async function processPendingActions(tz, { onSnoozeResult }: { onSnoozeResult?: (id: string, r: any) => unknown } = {}) {
  const queue = await drainPendingActions()
  if (queue.length === 0) return
  const uid = await liveUserId()
  if (!uid) return // sessão não-viva → não registra em conta errada (PO-SEC-2)
  let protocols = null
  for (const item of queue) {
    if (item.action === 'register' || item.action === 'open') {
      // 065 AD-8 (G-3): Live Activity é a superfície de dose ativa do iOS — mesmo `source` do Android.
      emitReminderOpened(REMINDER_SOURCES.DOSE_ACTIVITY, item.instanceId)
    }
    if (item.action === 'register') {
      // "Registrar" abre a modal bulk (sítio do injetável só selecionável lá) — paridade Android.
      // Resolve o doseItem p/ obter protocolId/treatmentPlanId/horário (o widget só tem instanceId).
      if (!protocols) protocols = await fetchEnrichedProtocols(uid, tz).catch(() => [])
      const doseItem = await resolveDoseItem(uid, protocols, tz, item.instanceId).catch(() => null)
      const params = buildRegisterParams(doseItem, item.treatmentId)
      // 090 D-2 (RC3 F2): mesmo helper do Android — tiro aninhado TABS → Hoje, espera as abas.
      if (params) navigateToDose(params)
    } else if (item.action === 'snooze') {
      if (!protocols) protocols = await fetchEnrichedProtocols(uid, tz).catch(() => [])
      await onSnoozeResult?.(item.instanceId, await _snoozeQueuedItem(uid, protocols, tz, item.instanceId))
    } else if (item.action === 'open') {
      // "Abrir" (later) — só traz o app pra Hoje, sem registrar.
      navigateToDose(null)
    }
  }
}

export default function DoseLiveActivityBridge() {
  const { user } = useAuth()
  const [protocols, setProtocols] = useState([])
  const [tz, setTz] = useState(DEFAULT_TZ)
  // 046: consentimento revogado equivale a "sem usuário" para a Live Activity — dispara o teardown do
  // logout (endLiveActivity) e trava load/derive. Re-consentir religa o userId.
  const consentSuppressed = useConsentSuppressed(user?.id ?? null)
  const userId = consentSuppressed ? null : (user?.id ?? null)
  const prevInstanceRef = useRef(null)
  const toast = useToast()
  const toastRef = useRef(toast)
  // tz espelhado em ref p/ o effect de AppState NÃO depender de tz (senão load() atualiza tz no
  // mount → re-dispara o effect → load() duplicado p/ fuso ≠ DEFAULT_TZ). Gemini #692. Sync em effect
  // (R-010: refs no topo; não escrever ref durante render).
  const tzRef = useRef(tz)
  const enabled = Platform.OS === 'ios' && liveActivitySupported

  useEffect(() => {
    tzRef.current = tz
  }, [tz])

  // O contexto do Toast muda a cada render do provider: ref evita re-disparar o effect de foreground.
  useEffect(() => {
    toastRef.current = toast
  }, [toast])

  const load = useCallback(async () => {
    if (!userId) return
    try {
      const settings = await getUserSettings(userId)
      const userTz = settings?.timezone || DEFAULT_TZ
      setTz(userTz)
      setProtocols(await fetchEnrichedProtocols(userId, userTz))
    } catch (err) {
      if (__DEV__) console.warn('[DoseLiveActivityBridge] load falhou', err?.message)
    }
  }, [userId])

  const derive = useCallback(async () => {
    if (!userId) return
    try {
      prevInstanceRef.current = await deriveAndDrive({
        userId,
        protocols,
        tz,
        prevInstanceId: prevInstanceRef.current,
        foreground: AppState.currentState === 'active',
      })
    } catch (err) {
      if (__DEV__) console.warn('[DoseLiveActivityBridge] derive falhou', err?.message)
    }
  }, [userId, protocols, tz])

  // Spec 101 (FR-001/FR-010): "Adiar" da LA → confirmação com o horário real; aceita ⇒ a LA da dose sai
  // de cena já (e o token per-Activity é zerado: o servidor a recria em `snoozed_until`, FR-008).
  const onSnoozeResult = useCallback(async (instanceId, result) => {
    toastRef.current?.show?.(snoozeToastMessage(result), { variant: result ? 'success' : 'error' })
    if (!result || prevInstanceRef.current !== instanceId) return
    await endLiveActivity()
    await _clearActivityToken(instanceId)
    prevInstanceRef.current = null
  }, [])

  // Logout → encerra a LA ativa.
  useEffect(() => {
    if (userId || !enabled) return
    // Spec 091: o `endSession` desativou a linha push-to-start no servidor. Sem zerar o dedupe, a
    // MESMA pessoa entrando de novo não re-registraria (mesmo userId+token) e o push-to-start ficaria
    // morto para ela.
    resetPushToStartDedupe()
    if (prevInstanceRef.current) {
      endLiveActivity()
      prevInstanceRef.current = null
    }
  }, [userId, enabled])

  // Carrega protocolos no mount + foreground; drena ações da ilha ao voltar a foreground.
  useEffect(() => {
    if (!enabled || !userId) return undefined
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    processPendingActions(tzRef.current, { onSnoozeResult })
    registerPushToStart(userId) // Spec 041: registra token push-to-start no mount/foreground
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return
      load()
      processPendingActions(tzRef.current, { onSnoozeResult })
      registerPushToStart(userId)
    })
    return () => sub.remove()
  }, [enabled, userId, load, onSnoozeResult])

  // Re-sync sob demanda (mutação de tratamento).
  useEffect(() => {
    if (!enabled) return undefined
    return onAlarmResync(load)
  }, [enabled, load])

  // Registro de dose (modal/in-app/alarme) → card `done` JÁ (sem esperar foreground/interval; iOS não
  // roda JS em bg e registrar in-app não muda AppState). Se a dose registrada é a que mostrávamos,
  // mostra o done com o HORÁRIO REAL da tomada (payload.takenAt — dose_instances não persiste isso;
  // o doseItem.registeredAt = scheduled_for, hora errada). Depois deriva a próxima dose ativa.
  useEffect(() => {
    if (!enabled) return undefined
    return onDoseActivityRefresh((payload) => {
      if (payload?.instanceId && payload.instanceId === prevInstanceRef.current) {
        showDoneLiveActivity({ instanceId: payload.instanceId, takenAt: payload.takenAt })
        prevInstanceRef.current = null
      }
      derive()
    })
  }, [enabled, derive])

  // Re-deriva no mount/troca + rede de segurança periódica (transição de estado via update).
  useEffect(() => {
    if (!enabled || !userId) return undefined
    derive()
    const timer = setInterval(derive, RESYNC_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [enabled, userId, derive])

  return null
}
